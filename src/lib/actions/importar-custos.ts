"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";
import { lancarCusto } from "@/lib/rpc";
import type { PagoPorTipo } from "@/lib/types";

/** Um custo a importar (já classificado no cliente). */
export type CustoImportado = {
  fornecedor: string;
  descricao: string | null;
  data: string;
  valor_base: number;
  iva: number;
  centro_custo_id: string;
  casa_id: string | null;
  pago_por_tipo: PagoPorTipo;
  pago_por_cc_id: string | null;
  taxa_plataforma: boolean;
  // Fiscais (do QR): NIF do emitente e ATCUD (chave única do documento).
  nif: string | null;
  atcud: string | null;
  // Id interno do documento no TOConline (dedup de importações automáticas).
  toconline_id?: string | null;
  // Origem da importação: "qr" | "excel" | "toconline".
  origem?: string | null;
  // Ficheiro já carregado no storage pelo cliente (opcional).
  storage_path: string | null;
  nome_ficheiro: string | null;
};

export type ImportarResultado = {
  ok: number;
  duplicadas: number;
  erros: string[];
};

function valida(c: CustoImportado): string | null {
  if (!c.fornecedor?.trim()) return "fornecedor em falta";
  if (!c.data) return "data em falta";
  if (!c.centro_custo_id) return "centro de custo em falta";
  if (!Number.isFinite(c.valor_base) || c.valor_base < 0) return "base inválida";
  if (!Number.isFinite(c.iva) || c.iva < 0) return "IVA inválido";
  if (!c.taxa_plataforma) {
    if (c.pago_por_tipo !== "sopro" && c.pago_por_tipo !== "cc") {
      return "pago por inválido";
    }
    if (c.pago_por_tipo === "cc" && !c.pago_por_cc_id) {
      return "centro de custo pagador em falta";
    }
  }
  return null;
}

/**
 * Importa vários custos de uma vez. Cada um: cria o custo, reparte 100% no
 * centro de custo escolhido (casa opcional), chama `lancar_custo` e — se houver
 * ficheiro — regista o documento. Nunca insere direto no livro.
 */
export async function importarCustosAction(
  custos: CustoImportado[],
): Promise<ImportarResultado> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { ok: 0, duplicadas: 0, erros: ["Sem organização."] };
  const org = sessao.orgId;
  if (!Array.isArray(custos) || custos.length === 0) {
    return { ok: 0, duplicadas: 0, erros: ["Nada para importar."] };
  }

  const supabase = await createClient();

  // CC Geral (representa a Sopro) — pagador por defeito quando não vem outro.
  const { data: geral } = await supabase
    .from("centros_custo")
    .select("id")
    .ilike("nome", "geral")
    .limit(1)
    .maybeSingle();
  const geralId = (geral as { id: string } | null)?.id ?? null;

  let ok = 0;
  let duplicadas = 0;
  const erros: string[] = [];

  // ATCUDs já existentes na BD (para detetar faturas repetidas).
  const atcuds = custos.map((c) => c.atcud).filter(Boolean) as string[];
  const jaExistem = new Set<string>();
  if (atcuds.length > 0) {
    const { data } = await supabase
      .from("custos")
      .select("atcud")
      .in("atcud", atcuds);
    for (const r of (data ?? []) as { atcud: string | null }[]) {
      if (r.atcud) jaExistem.add(r.atcud);
    }
  }
  const vistosNoLote = new Set<string>();

  // toconline_id já existentes na BD (dedup das importações do TOConline).
  const tocIds = custos.map((c) => c.toconline_id).filter(Boolean) as string[];
  const tocExistem = new Set<string>();
  if (tocIds.length > 0) {
    const { data } = await supabase
      .from("custos")
      .select("toconline_id")
      .eq("org_id", org)
      .in("toconline_id", tocIds);
    for (const r of (data ?? []) as { toconline_id: string | null }[]) {
      if (r.toconline_id) tocExistem.add(r.toconline_id);
    }
  }
  const tocVistosNoLote = new Set<string>();

  for (let i = 0; i < custos.length; i++) {
    const c = custos[i];
    const etiqueta = c.fornecedor?.trim() || `linha ${i + 1}`;

    const problema = valida(c);
    if (problema) {
      erros.push(`${etiqueta}: ${problema}`);
      continue;
    }

    // Deteção de duplicados por ATCUD (na BD ou já neste lote).
    if (c.atcud && (jaExistem.has(c.atcud) || vistosNoLote.has(c.atcud))) {
      duplicadas++;
      erros.push(`${etiqueta}: fatura repetida (ATCUD ${c.atcud}) — ignorada.`);
      continue;
    }
    if (c.atcud) vistosNoLote.add(c.atcud);

    // Deteção de duplicados por documento do TOConline.
    if (c.toconline_id && (tocExistem.has(c.toconline_id) || tocVistosNoLote.has(c.toconline_id))) {
      duplicadas++;
      erros.push(`${etiqueta}: documento já importado do TOConline — ignorado.`);
      continue;
    }
    if (c.toconline_id) tocVistosNoLote.add(c.toconline_id);

    const { data: custo, error: errCusto } = await supabase
      .from("custos")
      .insert({
        org_id: org,
        fornecedor: c.fornecedor.trim(),
        descricao: c.descricao?.trim() || null,
        data: c.data,
        valor_base: c.valor_base,
        iva: c.iva,
        nif: c.nif || null,
        taxa_plataforma: c.taxa_plataforma,
        pago_por_tipo: "cc",
        pago_por_pessoa_id: null,
        // Sem taxa: pagador = o CC indicado, ou o Geral (Sopro) por defeito.
        pago_por_cc_id: c.taxa_plataforma
          ? null
          : (c.pago_por_tipo === "cc" && c.pago_por_cc_id
              ? c.pago_por_cc_id
              : geralId),
        data_pagamento: c.taxa_plataforma ? null : c.data,
        atcud: c.atcud || null,
        toconline_id: c.toconline_id || null,
        origem_importacao: c.origem || null,
      })
      .select("id")
      .single();

    if (errCusto || !custo) {
      erros.push(`${etiqueta}: ${errCusto?.message ?? "falha ao criar"}`);
      continue;
    }

    const { error: errAloc } = await supabase.from("alocacoes").insert({
      org_id: org,
      custo_id: custo.id,
      centro_custo_id: c.centro_custo_id,
      casa_id: c.casa_id || null,
      percentagem: 100,
    });
    if (errAloc) {
      await supabase.from("custos").delete().eq("id", custo.id);
      erros.push(`${etiqueta}: ${errAloc.message}`);
      continue;
    }

    const { error: errRpc } = await lancarCusto(supabase, custo.id);
    if (errRpc) {
      erros.push(`${etiqueta}: criado, mas o lançamento falhou (${errRpc.message})`);
      // Não reverte: o custo fica criado para correção manual.
    }

    if (c.storage_path) {
      const { error: errDoc } = await supabase.from("documentos").insert({
        org_id: org,
        entidade_tipo: "custo",
        entidade_id: custo.id,
        storage_path: c.storage_path,
        nome_ficheiro: c.nome_ficheiro || "fatura",
      });
      if (errDoc) {
        erros.push(`${etiqueta}: custo criado, mas o documento não ficou ligado (${errDoc.message})`);
      }
    }

    // Memoriza o nome do fornecedor para este NIF (o primeiro fica — não sobrepõe).
    if (c.nif && c.fornecedor.trim()) {
      await supabase
        .from("fornecedores")
        .upsert(
          { org_id: org, nif: c.nif, nome: c.fornecedor.trim() },
          { onConflict: "org_id,nif", ignoreDuplicates: true },
        );
    }

    ok++;
  }

  revalidatePath("/custos");
  revalidatePath("/cc");
  return { ok, duplicadas, erros };
}

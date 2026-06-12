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
  // Fiscais (do QR): NIF do emitente e ATCUD (chave única do documento).
  nif: string | null;
  atcud: string | null;
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
  if (c.pago_por_tipo !== "sopro" && c.pago_por_tipo !== "cc") {
    return "pago por inválido";
  }
  if (c.pago_por_tipo === "cc" && !c.pago_por_cc_id) {
    return "centro de custo pagador em falta";
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

    const { data: custo, error: errCusto } = await supabase
      .from("custos")
      .insert({
        org_id: org,
        fornecedor: c.fornecedor.trim(),
        descricao: c.descricao?.trim() || null,
        data: c.data,
        valor_base: c.valor_base,
        iva: c.iva,
        pago_por_tipo: c.pago_por_tipo,
        pago_por_pessoa_id: null,
        pago_por_cc_id: c.pago_por_tipo === "cc" ? c.pago_por_cc_id : null,
        atcud: c.atcud || null,
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

    // Memoriza o nome do fornecedor para este NIF (para a próxima fatura).
    if (c.nif && c.fornecedor.trim()) {
      await supabase
        .from("fornecedores")
        .upsert(
          { org_id: org, nif: c.nif, nome: c.fornecedor.trim() },
          { onConflict: "org_id,nif" },
        );
    }

    ok++;
  }

  revalidatePath("/custos");
  revalidatePath("/cc");
  return { ok, duplicadas, erros };
}

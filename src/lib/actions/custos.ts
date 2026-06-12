"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";
import { lancarCusto } from "@/lib/rpc";
import type { PagoPorTipo, Alocacao } from "@/lib/types";

export type CustoState = { error?: string; mensagem?: string };

// Ponto 9: o custo é pago pela Sopro ou por outro CC (já não por pessoa).
const TIPOS: PagoPorTipo[] = ["sopro", "cc"];

type Extraido = {
  campos: {
    fornecedor: string;
    descricao: string | null;
    data: string;
    valor_base: number;
    iva: number;
    pago_por_tipo: PagoPorTipo;
    pago_por_pessoa_id: string | null;
    pago_por_cc_id: string | null;
  };
  alocacoes: Alocacao[];
};

function extrair(formData: FormData): Extraido | { error: string } {
  const fornecedor = String(formData.get("fornecedor") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const data = String(formData.get("data") ?? "");
  const valorBase = Number(formData.get("valor_base"));
  const iva = Number(formData.get("iva"));
  const pagoPorTipo = String(formData.get("pago_por_tipo") ?? "") as PagoPorTipo;
  const pagoPorCc = String(formData.get("pago_por_cc_id") ?? "");

  if (!fornecedor) return { error: "Indica o fornecedor." };
  if (!data) return { error: "Indica a data." };
  if (!Number.isFinite(valorBase) || valorBase < 0) {
    return { error: "Valor base inválido." };
  }
  if (!Number.isFinite(iva) || iva < 0) return { error: "IVA inválido." };
  if (!TIPOS.includes(pagoPorTipo)) return { error: "Indica quem pagou." };
  if (pagoPorTipo === "cc" && !pagoPorCc) {
    return { error: "Indica o centro de custo que pagou." };
  }

  let alocacoes: Alocacao[];
  try {
    alocacoes = JSON.parse(String(formData.get("alocacoes") ?? "[]"));
  } catch {
    return { error: "Alocações inválidas." };
  }
  alocacoes = alocacoes.filter((a) => a.centro_custo_id && a.percentagem > 0);
  if (alocacoes.length === 0) {
    return { error: "Adiciona pelo menos uma alocação." };
  }
  const soma = alocacoes.reduce((s, a) => s + Number(a.percentagem), 0);
  if (Math.abs(soma - 100) > 0.01) {
    return { error: `As alocações têm de somar 100% (estão em ${soma}%).` };
  }
  if (alocacoes.some((a) => a.percentagem <= 0 || a.percentagem > 100)) {
    return { error: "Cada percentagem tem de estar entre 0 e 100." };
  }

  return {
    campos: {
      fornecedor,
      descricao: descricao || null,
      data,
      valor_base: valorBase,
      iva,
      pago_por_tipo: pagoPorTipo,
      pago_por_pessoa_id: null,
      pago_por_cc_id: pagoPorTipo === "cc" ? pagoPorCc : null,
    },
    alocacoes,
  };
}

export async function criarCustoAction(
  _prev: CustoState,
  formData: FormData,
): Promise<CustoState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const org = sessao.orgId;

  const r = extrair(formData);
  if ("error" in r) return r;

  const supabase = await createClient();
  const { data: custo, error: errCusto } = await supabase
    .from("custos")
    .insert({ org_id: org, ...r.campos })
    .select("id")
    .single();

  if (errCusto || !custo) {
    return { error: errCusto?.message ?? "Não foi possível criar o custo." };
  }

  const { error: errAloc } = await supabase.from("alocacoes").insert(
    r.alocacoes.map((a) => ({
      org_id: org,
      custo_id: custo.id,
      centro_custo_id: a.centro_custo_id,
      casa_id: a.casa_id || null,
      percentagem: a.percentagem,
    })),
  );
  if (errAloc) {
    await supabase.from("custos").delete().eq("id", custo.id);
    return { error: errAloc.message };
  }

  const { error: errRpc } = await lancarCusto(supabase, custo.id);
  if (errRpc) {
    return { error: `Custo criado, mas o lançamento falhou: ${errRpc.message}` };
  }

  revalidatePath("/custos");
  revalidatePath("/cc");
  redirect("/custos");
}

export async function atualizarCustoAction(
  _prev: CustoState,
  formData: FormData,
): Promise<CustoState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const org = sessao.orgId;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Custo em falta." };

  const r = extrair(formData);
  if ("error" in r) return r;

  const supabase = await createClient();

  const { error: errUpd } = await supabase
    .from("custos")
    .update(r.campos)
    .eq("id", id);
  if (errUpd) return { error: errUpd.message };

  // Substitui as alocações.
  await supabase.from("alocacoes").delete().eq("custo_id", id);
  const { error: errAloc } = await supabase.from("alocacoes").insert(
    r.alocacoes.map((a) => ({
      org_id: org,
      custo_id: id,
      centro_custo_id: a.centro_custo_id,
      casa_id: a.casa_id || null,
      percentagem: a.percentagem,
    })),
  );
  if (errAloc) return { error: errAloc.message };

  const { error: errRpc } = await lancarCusto(supabase, id);
  if (errRpc) {
    return { error: `Guardado, mas o lançamento falhou: ${errRpc.message}` };
  }

  revalidatePath("/custos");
  revalidatePath("/cc");
  redirect("/custos");
}

/* ----------------------- Ações em massa --------------------------- */

export type LoteResultado = { ok: number; error?: string };

/** Muda quem pagou em vários custos de uma vez (re-lança cada um). */
export async function mudarPagoPorCustosAction(
  ids: string[],
  pagoPorTipo: PagoPorTipo,
  pagoPorCcId: string | null,
): Promise<LoteResultado> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { ok: 0, error: "Sem organização." };
  if (!ids.length) return { ok: 0 };
  if (pagoPorTipo !== "sopro" && pagoPorTipo !== "cc") {
    return { ok: 0, error: "Tipo de pagamento inválido." };
  }
  if (pagoPorTipo === "cc" && !pagoPorCcId) {
    return { ok: 0, error: "Indica o centro de custo que pagou." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("custos")
    .update({
      pago_por_tipo: pagoPorTipo,
      pago_por_pessoa_id: null,
      pago_por_cc_id: pagoPorTipo === "cc" ? pagoPorCcId : null,
    })
    .in("id", ids);
  if (error) return { ok: 0, error: error.message };

  for (const id of ids) await lancarCusto(supabase, id);
  revalidatePath("/custos");
  revalidatePath("/cc");
  return { ok: ids.length };
}

/** Muda o centro de custo (100%, sem casa) de vários custos (re-lança cada um). */
export async function mudarCentroCustoCustosAction(
  ids: string[],
  centroCustoId: string,
): Promise<LoteResultado> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { ok: 0, error: "Sem organização." };
  if (!ids.length) return { ok: 0 };
  if (!centroCustoId) return { ok: 0, error: "Indica o centro de custo." };
  const org = sessao.orgId;

  const supabase = await createClient();
  // Substitui as alocações por uma só, 100% no CC escolhido.
  await supabase.from("alocacoes").delete().in("custo_id", ids);
  const { error } = await supabase.from("alocacoes").insert(
    ids.map((custoId) => ({
      org_id: org,
      custo_id: custoId,
      centro_custo_id: centroCustoId,
      casa_id: null,
      percentagem: 100,
    })),
  );
  if (error) return { ok: 0, error: error.message };

  for (const id of ids) await lancarCusto(supabase, id);
  revalidatePath("/custos");
  revalidatePath("/cc");
  return { ok: ids.length };
}

/** Apaga vários custos de uma vez (remove primeiro os lançamentos do livro). */
export async function apagarCustosAction(
  ids: string[],
): Promise<LoteResultado> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { ok: 0, error: "Sem organização." };
  if (!ids.length) return { ok: 0 };
  const supabase = await createClient();
  await supabase
    .from("lancamentos")
    .delete()
    .eq("origem", "custo")
    .in("origem_id", ids);
  const { error } = await supabase.from("custos").delete().in("id", ids);
  if (error) return { ok: 0, error: error.message };
  revalidatePath("/custos");
  revalidatePath("/cc");
  return { ok: ids.length };
}

/** Duplica um custo (útil para recorrentes) e abre a cópia para edição. */
export async function duplicarCustoAction(formData: FormData): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const org = sessao.orgId;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: orig } = await supabase
    .from("custos")
    .select(
      "fornecedor, descricao, data, valor_base, iva, pago_por_tipo, pago_por_pessoa_id, pago_por_cc_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!orig) return;

  // Não copiamos o ATCUD: a cópia é um novo custo (a chave fiscal é única).
  const { data: novo, error } = await supabase
    .from("custos")
    .insert({ org_id: org, ...orig })
    .select("id")
    .single();
  if (error || !novo) return;

  const { data: alocs } = await supabase
    .from("alocacoes")
    .select("centro_custo_id, casa_id, percentagem")
    .eq("custo_id", id);
  if (alocs && alocs.length > 0) {
    await supabase.from("alocacoes").insert(
      alocs.map((a) => ({
        org_id: org,
        custo_id: novo.id,
        centro_custo_id: a.centro_custo_id,
        casa_id: a.casa_id,
        percentagem: a.percentagem,
      })),
    );
  }

  await lancarCusto(supabase, novo.id);
  revalidatePath("/custos");
  revalidatePath("/cc");
  redirect(`/custos/${novo.id}`);
}

export async function apagarCustoAction(formData: FormData): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  // Remove os lançamentos do livro; as alocações caem por cascade ao apagar o custo.
  await supabase
    .from("lancamentos")
    .delete()
    .eq("origem", "custo")
    .eq("origem_id", id);
  await supabase.from("custos").delete().eq("id", id);
  revalidatePath("/custos");
  revalidatePath("/cc");
  redirect("/custos");
}

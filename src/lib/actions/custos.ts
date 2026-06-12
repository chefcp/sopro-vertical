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

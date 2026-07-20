"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";

export type MovState = { error?: string };

const CONTAS = ["resultado", "iva", "suprimentos", "tesouraria", "cc_corrente"];

function revalida() {
  revalidatePath("/movimentos");
  revalidatePath("/lancamentos");
  revalidatePath("/cc");
}

/** Martela uma linha do movimento (CC/casa/valor/descrição) — trava o movimento. */
export async function editarLinhaMovimentoAction(input: {
  id: string;
  centro_custo_id: string;
  casa_id: string | null;
  valor: number;
  descricao: string;
}): Promise<MovState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  if (!input.id) return { error: "Linha em falta." };
  if (!input.centro_custo_id) return { error: "Indica o centro de custo." };
  if (!Number.isFinite(input.valor)) return { error: "Valor inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mov_editar_linha", {
    p_id: input.id,
    p_centro_custo_id: input.centro_custo_id,
    p_casa_id: input.casa_id,
    p_valor: input.valor,
    p_descricao: input.descricao || null,
  });
  if (error) return { error: error.message };
  revalida();
  return {};
}

/** Acrescenta uma linha (submovimento) a um movimento existente — trava-o. */
export async function adicionarLinhaMovimentoAction(input: {
  ref_id: string;
  conta: string;
  centro_custo_id: string;
  casa_id: string | null;
  valor: number;
  descricao: string;
}): Promise<MovState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  if (!input.ref_id) return { error: "Movimento em falta." };
  if (!CONTAS.includes(input.conta)) return { error: "Escolhe a conta." };
  if (!input.centro_custo_id) return { error: "Indica o centro de custo." };
  if (!Number.isFinite(input.valor) || input.valor === 0) {
    return { error: "Indica um valor (≠ 0)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mov_adicionar_linha", {
    p_ref_id: input.ref_id,
    p_conta: input.conta,
    p_centro_custo_id: input.centro_custo_id,
    p_casa_id: input.casa_id,
    p_valor: input.valor,
    p_descricao: input.descricao || null,
  });
  if (error) return { error: error.message };
  revalida();
  return {};
}

/** Remove uma linha do movimento. */
export async function removerLinhaMovimentoAction(id: string): Promise<MovState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mov_remover_linha", { p_id: id });
  if (error) return { error: error.message };
  revalida();
  return {};
}

/** Destrava um movimento (volta ao automático, regenerando do custo/reserva). */
export async function destravarMovimentoAction(refId: string): Promise<MovState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mov_destravar", { p_ref_id: refId });
  if (error) return { error: error.message };
  revalida();
  return {};
}

export type LinhaManual = {
  conta: string;
  centro_custo_id: string;
  casa_id: string | null;
  valor: number;
  descricao: string;
};

/** Cria um "movimento geral" manual com vários submovimentos. */
export async function criarMovimentoManualAction(input: {
  titulo: string;
  data: string;
  linhas: LinhaManual[];
}): Promise<MovState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  if (!input.titulo.trim()) return { error: "Dá um nome ao movimento." };
  if (!input.data) return { error: "Indica a data." };
  const linhas = input.linhas.filter(
    (l) => l.conta && l.centro_custo_id && Number.isFinite(l.valor) && l.valor !== 0,
  );
  if (linhas.length === 0) return { error: "Acrescenta pelo menos uma linha válida." };
  for (const l of linhas) {
    if (!CONTAS.includes(l.conta)) return { error: "Conta inválida numa das linhas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mov_criar_manual", {
    p_org: sessao.orgId,
    p_titulo: input.titulo.trim(),
    p_data: input.data,
    p_linhas: linhas.map((l) => ({
      conta: l.conta,
      centro_custo_id: l.centro_custo_id,
      casa_id: l.casa_id || null,
      valor: l.valor,
      descricao: l.descricao || null,
    })),
  });
  if (error) return { error: error.message };
  revalida();
  return {};
}

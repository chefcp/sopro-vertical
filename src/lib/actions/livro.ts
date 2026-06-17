"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";
import {
  redistribuirConta,
  pagarDono,
  distribuirReembolsoIva,
  transferirCc,
  lancarManual,
  reforcarSuprimentos,
  centralizarIva,
} from "@/lib/rpc";
import type { Conta } from "@/lib/types";

export type AccaoState = { error?: string; mensagem?: string };

const CONTAS_VALIDAS: Conta[] = [
  "resultado",
  "iva",
  "suprimentos",
  "tesouraria",
  "cc_corrente",
];

/** Redistribui o saldo de uma conta de um CC pelos destinos da chave. */
export async function redistribuirContaAction(
  _prev: AccaoState,
  formData: FormData,
): Promise<AccaoState> {
  const cc = String(formData.get("cc") ?? "");
  const conta = String(formData.get("conta") ?? "") as Conta;

  if (!cc || !CONTAS_VALIDAS.includes(conta)) {
    return { error: "Indica a conta a redistribuir." };
  }

  const supabase = await createClient();
  const { error } = await redistribuirConta(supabase, cc, conta);
  if (error) return { error: error.message };

  revalidatePath(`/cc/${cc}`);
  revalidatePath("/cc");
  return { mensagem: "Conta redistribuída." };
}

/** Paga ao dono do CC (tesouraria e suprimentos podem ficar negativos). */
export async function pagarDonoAction(
  _prev: AccaoState,
  formData: FormData,
): Promise<AccaoState> {
  const cc = String(formData.get("cc") ?? "");
  const valor = Number(formData.get("valor"));

  if (!cc) return { error: "Centro de custo em falta." };
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "Indica um valor válido." };
  }

  const supabase = await createClient();
  const { error } = await pagarDono(supabase, cc, valor);
  if (error) return { error: error.message };

  revalidatePath(`/cc/${cc}`);
  revalidatePath("/cc");
  return { mensagem: "Pagamento ao dono registado." };
}

/** Transfere um valor de um CC para outro (conta-corrente). */
export async function transferirCcAction(
  _prev: AccaoState,
  formData: FormData,
): Promise<AccaoState> {
  const origem = String(formData.get("origem_cc") ?? "");
  const destino = String(formData.get("destino_cc") ?? "");
  const valor = Number(formData.get("valor"));

  if (!origem) return { error: "Centro de custo de origem em falta." };
  if (!destino) return { error: "Indica o centro de custo de destino." };
  if (origem === destino) {
    return { error: "Origem e destino têm de ser diferentes." };
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "Indica um valor válido." };
  }

  const supabase = await createClient();
  const { error } = await transferirCc(supabase, origem, destino, valor);
  if (error) return { error: error.message };

  revalidatePath(`/cc/${origem}`);
  revalidatePath(`/cc/${destino}`);
  revalidatePath("/cc");
  return { mensagem: "Transferência registada." };
}

/** Reforça os suprimentos de um CC (entra dinheiro: tesouraria + e suprimentos +). */
export async function reforcarSuprimentosAction(
  _prev: AccaoState,
  formData: FormData,
): Promise<AccaoState> {
  const cc = String(formData.get("cc") ?? "");
  const valor = Number(formData.get("valor"));

  if (!cc) return { error: "Centro de custo em falta." };
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "Indica um valor válido." };
  }

  const supabase = await createClient();
  const { error } = await reforcarSuprimentos(supabase, cc, valor);
  if (error) return { error: error.message };

  revalidatePath(`/cc/${cc}`);
  revalidatePath("/cc");
  return { mensagem: "Reforço de suprimentos registado." };
}

/** Lançamento manual a uma conta de um CC (valor positivo entra, negativo sai). */
const CONTAS_MANUAIS: Conta[] = ["resultado", "iva", "suprimentos", "tesouraria"];

export async function lancarManualAction(
  _prev: AccaoState,
  formData: FormData,
): Promise<AccaoState> {
  const cc = String(formData.get("cc") ?? "");
  const conta = String(formData.get("conta") ?? "") as Conta;
  const sinal = String(formData.get("sinal") ?? "+");
  const valorAbs = Number(formData.get("valor"));
  const descricao = String(formData.get("descricao") ?? "").trim();

  if (!cc) return { error: "Centro de custo em falta." };
  if (!CONTAS_MANUAIS.includes(conta)) return { error: "Escolhe a conta." };
  if (!Number.isFinite(valorAbs) || valorAbs <= 0) {
    return { error: "Indica um valor válido." };
  }
  const valor = sinal === "-" ? -valorAbs : valorAbs;

  const supabase = await createClient();
  const { error } = await lancarManual(supabase, cc, conta, valor, descricao || null);
  if (error) return { error: error.message };

  revalidatePath(`/cc/${cc}`);
  revalidatePath("/cc");
  return { mensagem: "Lançamento manual registado." };
}

/** Move o IVA (e tesouraria) de um CC para o Geral — manter o IVA na Sopro. */
export async function centralizarIvaAction(
  _prev: AccaoState,
  formData: FormData,
): Promise<AccaoState> {
  const cc = String(formData.get("cc") ?? "");
  const valor = Number(formData.get("valor"));

  if (!cc) return { error: "Centro de custo em falta." };
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "Indica um valor válido." };
  }

  const supabase = await createClient();
  const { error } = await centralizarIva(supabase, cc, valor);
  if (error) return { error: error.message };

  revalidatePath(`/cc/${cc}`);
  revalidatePath("/cc");
  return { mensagem: "IVA centralizado na Sopro." };
}

/** Distribui um reembolso de IVA recebido pela organização. */
export async function distribuirReembolsoIvaAction(
  _prev: AccaoState,
  formData: FormData,
): Promise<AccaoState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const valor = Number(formData.get("valor"));
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "Indica um valor válido." };
  }

  const supabase = await createClient();
  const { error } = await distribuirReembolsoIva(supabase, sessao.orgId, valor);
  if (error) return { error: error.message };

  revalidatePath("/cc");
  return { mensagem: "Reembolso de IVA distribuído." };
}

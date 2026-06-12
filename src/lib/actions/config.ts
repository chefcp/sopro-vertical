"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";

export type ConfigState = { error?: string; mensagem?: string };

const CONTAS_CHAVE = ["resultado", "iva", "suprimentos", "tesouraria"];

function revalidar() {
  revalidatePath("/config");
  revalidatePath("/cc");
}

/* ----------------------------- Pessoas ----------------------------- */

export async function criarPessoaAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Indica o nome." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pessoas")
    .insert({ org_id: sessao.orgId, nome });
  if (error) return { error: error.message };

  revalidar();
  return { mensagem: "Pessoa adicionada." };
}

/* -------------------------- Centros de custo ----------------------- */

export async function criarCentroCustoAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Indica o nome do centro de custo." };
  const geraFaturacao = formData.get("gera_faturacao") === "on";
  const ordem = Number(formData.get("ordem") ?? 100);

  const supabase = await createClient();
  const { error } = await supabase.from("centros_custo").insert({
    org_id: sessao.orgId,
    nome,
    gera_faturacao: geraFaturacao,
    ordem: Number.isFinite(ordem) ? ordem : 100,
  });
  if (error) return { error: error.message };

  revalidar();
  return { mensagem: "Centro de custo criado." };
}

export async function atualizarCentroCustoAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Centro de custo em falta." };
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Indica o nome." };
  const geraFaturacao = formData.get("gera_faturacao") === "on";
  const ordem = Number(formData.get("ordem") ?? 100);

  const supabase = await createClient();
  const { error } = await supabase
    .from("centros_custo")
    .update({
      nome,
      gera_faturacao: geraFaturacao,
      ordem: Number.isFinite(ordem) ? ordem : 100,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  return { mensagem: "Centro de custo atualizado." };
}

/* ----------------------- Chaves de repartição ---------------------- */

export async function criarChaveAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const origem = String(formData.get("origem_cc_id") ?? "");
  const destino = String(formData.get("destino_cc_id") ?? "");
  const conta = String(formData.get("conta") ?? "");
  const peso = Number(formData.get("peso"));

  if (!origem) return { error: "Indica o CC de origem." };
  if (!destino) return { error: "Indica o CC de destino." };
  if (origem === destino) {
    return { error: "Origem e destino têm de ser diferentes." };
  }
  if (!CONTAS_CHAVE.includes(conta)) return { error: "Indica a conta." };
  if (!Number.isFinite(peso) || peso <= 0) {
    return { error: "O peso tem de ser maior que 0." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("chaves_reparticao").insert({
    org_id: sessao.orgId,
    origem_cc_id: origem,
    destino_cc_id: destino,
    conta,
    peso,
  });
  if (error) return { error: error.message };

  revalidar();
  return { mensagem: "Chave de repartição adicionada." };
}

/* ----------------------- Taxas por canal --------------------------- */

const CANAIS_TAXA = ["airbnb", "vrbo", "proprio", "por_fora", "outro"];

export async function guardarTaxasCanalAction(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const linhas: { org_id: string; canal: string; percentagem: number }[] = [];
  for (const canal of CANAIS_TAXA) {
    const pct = Number(formData.get(`pct_${canal}`));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { error: `Percentagem inválida para ${canal}.` };
    }
    linhas.push({ org_id: sessao.orgId, canal, percentagem: pct });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("taxas_canal")
    .upsert(linhas, { onConflict: "org_id,canal" });
  if (error) return { error: error.message };

  revalidar();
  revalidatePath("/reservas");
  return { mensagem: "Taxas por canal guardadas." };
}

export async function removerChaveAction(formData: FormData): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("chaves_reparticao").delete().eq("id", id);
  revalidar();
}

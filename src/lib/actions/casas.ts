"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";

export type CasaState = { error?: string; mensagem?: string };

type Campos = {
  nome: string;
  morada: string | null;
  centro_custo_id: string;
  peso_base: number;
  iva_percentagem: number;
};

function extrair(formData: FormData): Campos | { error: string } {
  const nome = String(formData.get("nome") ?? "").trim();
  const morada = String(formData.get("morada") ?? "").trim();
  const centro = String(formData.get("centro_custo_id") ?? "");
  const peso = Number(formData.get("peso_base"));
  const iva = Number(formData.get("iva_percentagem"));

  if (!nome) return { error: "Indica o nome da casa." };
  if (!centro) return { error: "Indica o centro de custo." };
  if (!Number.isFinite(peso) || peso < 0) {
    return { error: "Peso de repartição inválido." };
  }
  if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
    return { error: "IVA (%) inválido." };
  }
  return {
    nome,
    morada: morada || null,
    centro_custo_id: centro,
    peso_base: peso,
    iva_percentagem: iva,
  };
}

export async function criarCasaAction(
  _prev: CasaState,
  formData: FormData,
): Promise<CasaState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const campos = extrair(formData);
  if ("error" in campos) return campos;

  const supabase = await createClient();
  const { error } = await supabase
    .from("casas")
    .insert({ org_id: sessao.orgId, ...campos });
  if (error) return { error: error.message };

  revalidatePath("/casas");
  revalidatePath("/cc");
  redirect("/casas");
}

export async function atualizarCasaAction(
  _prev: CasaState,
  formData: FormData,
): Promise<CasaState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Casa em falta." };

  const campos = extrair(formData);
  if ("error" in campos) return campos;

  const supabase = await createClient();
  const { error } = await supabase.from("casas").update(campos).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/casas");
  revalidatePath("/cc");
  redirect("/casas");
}

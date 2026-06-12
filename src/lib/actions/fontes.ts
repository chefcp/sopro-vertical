"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";

export type FonteState = { error?: string; mensagem?: string };

const TIPOS = ["airbnb_ical", "vrbo_ical", "lodgify_api", "outro_ical"];

export async function criarFonteAction(
  _prev: FonteState,
  formData: FormData,
): Promise<FonteState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const casaId = String(formData.get("casa_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const referencia = String(formData.get("referencia") ?? "").trim();

  if (!casaId) return { error: "Casa em falta." };
  if (!TIPOS.includes(tipo)) return { error: "Indica o tipo de fonte." };
  if (!referencia) {
    return { error: "Indica a referência (URL iCal ou id de propriedade)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("fontes_reserva").insert({
    org_id: sessao.orgId,
    casa_id: casaId,
    tipo,
    referencia,
  });
  if (error) return { error: error.message };

  revalidatePath(`/casas/${casaId}`);
  return { mensagem: "Fonte adicionada." };
}

export async function removerFonteAction(formData: FormData): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const id = String(formData.get("id") ?? "");
  const casaId = String(formData.get("casa_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("fontes_reserva").delete().eq("id", id);
  if (casaId) revalidatePath(`/casas/${casaId}`);
}

export async function alternarFonteAction(formData: FormData): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const id = String(formData.get("id") ?? "");
  const casaId = String(formData.get("casa_id") ?? "");
  const ativo = formData.get("ativo") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("fontes_reserva").update({ ativo: !ativo }).eq("id", id);
  if (casaId) revalidatePath(`/casas/${casaId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";

export type ReservaState = { error?: string; mensagem?: string };

const CANAIS = ["airbnb", "vrbo", "proprio", "por_fora", "outro"];

function num(formData: FormData, campo: string): number {
  return Number(formData.get(campo) ?? 0);
}

type CamposReserva = {
  casa_id: string;
  canal: string;
  data_checkin: string | null;
  data_checkout: string | null;
  valor_total: number;
  iva_liquidado: number;
  taxa_canal: number;
  comissao_stripe: number;
  faturado: boolean;
  fora_sopro: boolean;
  hospede: string | null;
  estado: string;
  recebido: boolean;
  data_recebimento: string | null;
  // Quando o utilizador grava/valida, manda sobre as importações.
  editada_manual: true;
  // false = rascunho (fora do livro); true = fechada (o trigger lança).
  validada: boolean;
};

function extrair(formData: FormData): CamposReserva | { error: string } {
  const casaId = String(formData.get("casa_id") ?? "");
  const canal = String(formData.get("canal") ?? "");
  const checkin = String(formData.get("data_checkin") ?? "");
  const checkout = String(formData.get("data_checkout") ?? "");
  const valorTotal = num(formData, "valor_total");
  const ivaLiquidado = num(formData, "iva_liquidado");
  const taxaCanal = num(formData, "taxa_canal");
  const comissaoStripe = num(formData, "comissao_stripe");
  const hospede = String(formData.get("hospede") ?? "").trim();
  const estado = String(formData.get("estado") ?? "ativa");
  const recebido = formData.get("recebido") === "on";
  const dataRecebimento = String(formData.get("data_recebimento") ?? "");
  // O botão "Validar e fechar" envia validada=true; "Guardar" envia false.
  const validada = formData.get("validada") === "true";

  if (!casaId) return { error: "Indica a casa." };
  if (!CANAIS.includes(canal)) return { error: "Indica o canal." };
  if (!["ativa", "cancelada"].includes(estado)) {
    return { error: "Estado inválido." };
  }
  for (const [v, nome] of [
    [valorTotal, "Valor total"],
    [ivaLiquidado, "IVA liquidado"],
    [taxaCanal, "Taxa do canal"],
    [comissaoStripe, "Comissão Stripe"],
  ] as const) {
    if (!Number.isFinite(v) || v < 0) return { error: `${nome} inválido.` };
  }
  if (checkin && checkout && checkout < checkin) {
    return { error: "O check-out não pode ser antes do check-in." };
  }

  return {
    casa_id: casaId,
    canal,
    data_checkin: checkin || null,
    data_checkout: checkout || null,
    valor_total: valorTotal,
    iva_liquidado: ivaLiquidado,
    taxa_canal: taxaCanal,
    comissao_stripe: comissaoStripe,
    faturado: formData.get("faturado") === "on",
    fora_sopro: formData.get("fora_sopro") === "on",
    hospede: hospede || null,
    estado,
    recebido,
    data_recebimento: recebido ? dataRecebimento || null : null,
    editada_manual: true,
    validada,
  };
}

// O LIVRO é tratado pelo trigger reserva_ledger (conforme `validada`).
// A app NUNCA chama lancar_reserva diretamente.

export async function criarReservaAction(
  _prev: ReservaState,
  formData: FormData,
): Promise<ReservaState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const campos = extrair(formData);
  if ("error" in campos) return campos;

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .insert({ org_id: sessao.orgId, ...campos });
  if (error) return { error: error.message };

  revalidatePath("/reservas");
  revalidatePath("/cc");
  redirect("/reservas");
}

export async function atualizarReservaAction(
  _prev: ReservaState,
  formData: FormData,
): Promise<ReservaState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Reserva em falta." };

  const campos = extrair(formData);
  if ("error" in campos) return campos;

  const supabase = await createClient();
  const { error } = await supabase.from("reservas").update(campos).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/reservas");
  revalidatePath("/cc");
  redirect("/reservas");
}

/** Valida várias reservas de uma vez (entram no livro via trigger). */
export async function validarReservasAction(
  ids: string[],
): Promise<{ ok: number; error?: string }> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { ok: 0, error: "Sem organização." };
  if (!ids.length) return { ok: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservas")
    .update({ validada: true })
    .in("id", ids)
    .select("id");
  if (error) return { ok: 0, error: error.message };
  revalidatePath("/reservas");
  revalidatePath("/cc");
  return { ok: data?.length ?? 0 };
}

/**
 * Fecha várias reservas de uma vez: valida + fatura + marca recebida, com
 * `data_recebimento = data do check-in` de cada reserva (a tesouraria entra
 * nessa data via trigger). Reservas sem check-in são validadas e faturadas,
 * mas não marcadas recebidas (faltaria a data).
 */
export async function validarFaturarReceberAction(
  ids: string[],
): Promise<{ ok: number; semData: number; error?: string }> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { ok: 0, semData: 0, error: "Sem organização." };
  if (!ids.length) return { ok: 0, semData: 0 };
  const supabase = await createClient();

  // Precisamos do check-in de cada reserva — supabase-js não faz col→col,
  // por isso lê-se primeiro e agrupa-se por data para minimizar updates.
  const { data: rows, error: errSel } = await supabase
    .from("reservas")
    .select("id, data_checkin")
    .in("id", ids);
  if (errSel) return { ok: 0, semData: 0, error: errSel.message };

  const porData = new Map<string, string[]>();
  const semData: string[] = [];
  for (const r of (rows ?? []) as { id: string; data_checkin: string | null }[]) {
    if (r.data_checkin) {
      const lista = porData.get(r.data_checkin) ?? [];
      lista.push(r.id);
      porData.set(r.data_checkin, lista);
    } else {
      semData.push(r.id);
    }
  }

  let ok = 0;
  for (const [data, lista] of porData) {
    const { data: upd, error } = await supabase
      .from("reservas")
      .update({
        validada: true,
        faturado: true,
        recebido: true,
        data_recebimento: data,
      })
      .in("id", lista)
      .select("id");
    if (error) return { ok, semData: 0, error: error.message };
    ok += upd?.length ?? 0;
  }

  if (semData.length) {
    const { error } = await supabase
      .from("reservas")
      .update({ validada: true, faturado: true })
      .in("id", semData);
    if (error) return { ok, semData: 0, error: error.message };
  }

  revalidatePath("/reservas");
  revalidatePath("/cc");
  return { ok, semData: semData.length };
}

/** Desvalida (volta a rascunho): o trigger remove-a do livro; fica editável. */
export async function desvalidarReservaAction(
  formData: FormData,
): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("reservas").update({ validada: false }).eq("id", id);
  revalidatePath("/reservas");
  revalidatePath("/cc");
  redirect(`/reservas/${id}`);
}

export async function apagarReservaAction(formData: FormData): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  // Remove primeiro os lançamentos no livro, depois a reserva.
  await supabase
    .from("lancamentos")
    .delete()
    .eq("origem", "reserva")
    .eq("origem_id", id);
  await supabase.from("reservas").delete().eq("id", id);
  revalidatePath("/reservas");
  revalidatePath("/cc");
  redirect("/reservas");
}

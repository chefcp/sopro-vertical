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
  data_faturacao: string | null;
  valor_total: number;
  iva_liquidado: number;
  faturado: boolean;
  fora_sopro: boolean;
  hospede: string | null;
  estado: string;
  // Quando o utilizador grava/valida, manda sobre as importações.
  editada_manual: true;
  // false = rascunho (fora do livro); true = fechada (o trigger lança).
  validada: boolean;
};

type Recebimento = { valor: number; data: string | null };
type ExtraidoReserva = { campos: CamposReserva; recebimentos: Recebimento[] };

function extrair(formData: FormData): ExtraidoReserva | { error: string } {
  const casaId = String(formData.get("casa_id") ?? "");
  const canal = String(formData.get("canal") ?? "");
  const checkin = String(formData.get("data_checkin") ?? "");
  const checkout = String(formData.get("data_checkout") ?? "");
  const dataFaturacao = String(formData.get("data_faturacao") ?? "");
  const valorTotal = num(formData, "valor_total");
  const ivaLiquidado = num(formData, "iva_liquidado");
  const hospede = String(formData.get("hospede") ?? "").trim();
  const estado = String(formData.get("estado") ?? "ativa");
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
  ] as const) {
    if (!Number.isFinite(v) || v < 0) return { error: `${nome} inválido.` };
  }
  if (checkin && checkout && checkout < checkin) {
    return { error: "O check-out não pode ser antes do check-in." };
  }

  let recebimentos: Recebimento[] = [];
  try {
    const raw = JSON.parse(String(formData.get("recebimentos") ?? "[]"));
    recebimentos = (raw as { valor: unknown; data: unknown }[])
      .map((x) => ({ valor: Number(x.valor), data: (x.data as string) || null }))
      .filter((x) => Number.isFinite(x.valor) && x.valor !== 0);
  } catch {
    return { error: "Recebimentos inválidos." };
  }

  return {
    campos: {
      casa_id: casaId,
      canal,
      data_checkin: checkin || null,
      data_checkout: checkout || null,
      data_faturacao: dataFaturacao || null,
      valor_total: valorTotal,
      iva_liquidado: ivaLiquidado,
      faturado: formData.get("faturado") === "on",
      fora_sopro: formData.get("fora_sopro") === "on",
      hospede: hospede || null,
      estado,
      editada_manual: true,
      validada,
    },
    recebimentos,
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

  const r = extrair(formData);
  if ("error" in r) return r;

  const supabase = await createClient();
  const { data: nova, error } = await supabase
    .from("reservas")
    .insert({ org_id: sessao.orgId, ...r.campos })
    .select("id")
    .single();
  if (error || !nova) return { error: error?.message ?? "Falha ao criar." };

  if (r.recebimentos.length > 0) {
    await supabase.from("recebimentos").insert(
      r.recebimentos.map((x) => ({
        org_id: sessao.orgId,
        reserva_id: nova.id,
        valor: x.valor,
        data: x.data,
      })),
    );
  }

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

  const r = extrair(formData);
  if ("error" in r) return r;

  const supabase = await createClient();
  const { error } = await supabase.from("reservas").update(r.campos).eq("id", id);
  if (error) return { error: error.message };

  // Substitui os recebimentos (o trigger re-lança a reserva).
  await supabase.from("recebimentos").delete().eq("reserva_id", id);
  if (r.recebimentos.length > 0) {
    await supabase.from("recebimentos").insert(
      r.recebimentos.map((x) => ({
        org_id: sessao.orgId,
        reserva_id: id,
        valor: x.valor,
        data: x.data,
      })),
    );
  }

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
 * Fecha várias reservas: valida + fatura + cria um recebimento total
 * (valor = valor_total, data = check-in) por cada reserva (não-fora) que ainda
 * não tenha recebimentos. A tesouraria entra via trigger dos recebimentos.
 */
export async function validarFaturarReceberAction(
  ids: string[],
): Promise<{ ok: number; semData: number; error?: string }> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { ok: 0, semData: 0, error: "Sem organização." };
  if (!ids.length) return { ok: 0, semData: 0 };
  const supabase = await createClient();

  const { data: rows, error: errSel } = await supabase
    .from("reservas")
    .select("id, valor_total, data_checkin, fora_sopro")
    .in("id", ids);
  if (errSel) return { ok: 0, semData: 0, error: errSel.message };

  const { error: errUpd } = await supabase
    .from("reservas")
    .update({ validada: true, faturado: true })
    .in("id", ids);
  if (errUpd) return { ok: 0, semData: 0, error: errUpd.message };

  // Não duplicar recebimentos em reservas que já têm.
  const { data: jaRec } = await supabase
    .from("recebimentos")
    .select("reserva_id")
    .in("reserva_id", ids);
  const comRec = new Set(
    (jaRec ?? []).map((x: { reserva_id: string }) => x.reserva_id),
  );

  let semData = 0;
  const novos: {
    org_id: string;
    reserva_id: string;
    valor: number;
    data: string | null;
  }[] = [];
  for (const r of (rows ?? []) as {
    id: string;
    valor_total: number;
    data_checkin: string | null;
    fora_sopro: boolean;
  }[]) {
    if (r.fora_sopro || comRec.has(r.id)) continue;
    if (!r.data_checkin) semData++;
    novos.push({
      org_id: sessao.orgId,
      reserva_id: r.id,
      valor: Number(r.valor_total),
      data: r.data_checkin,
    });
  }
  if (novos.length > 0) {
    const { error } = await supabase.from("recebimentos").insert(novos);
    if (error) return { ok: ids.length, semData, error: error.message };
  }

  revalidatePath("/reservas");
  revalidatePath("/cc");
  return { ok: ids.length, semData };
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

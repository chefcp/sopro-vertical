"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";
import { parseIcs, ehBloqueio, nomeHospede } from "@/lib/ical";
import { canalDeFonteIcal } from "@/lib/canais";

export type SyncState = { error?: string; mensagem?: string };

export type PropriedadesLodgify = {
  propriedades?: { id: string; nome: string }[];
  error?: string;
};

/** Lista as propriedades do Lodgify (para o utilizador escolher pelo nome). */
export async function listarPropriedadesLodgify(): Promise<PropriedadesLodgify> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem sessão." };
  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) {
    return { error: "LODGIFY_API_KEY não está definida no servidor." };
  }
  try {
    const resp = await fetch("https://api.lodgify.com/v2/properties?size=50", {
      headers: { "X-ApiKey": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (!resp.ok) return { error: `Lodgify devolveu HTTP ${resp.status}.` };
    const json: unknown = await resp.json();
    const items: Record<string, unknown>[] = Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : (((json as Record<string, unknown>)?.items as Record<
          string,
          unknown
        >[]) ?? []);
    const propriedades = items
      .map((p) => ({
        id: String(p.id ?? ""),
        nome: String(p.name ?? p.id ?? ""),
      }))
      .filter((p) => p.id);
    return { propriedades };
  } catch (e) {
    return { error: String(e) };
  }
}

type Fonte = {
  id: string;
  casa_id: string;
  tipo: string;
  referencia: string;
};

type Contagem = { novas: number; atualizadas: number; canceladas: number };

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* iCal (Airbnb/VRBO/outro)                                            */
/* ------------------------------------------------------------------ */

async function importarIcal(
  supabase: SupabaseClient,
  org: string,
  fonte: Fonte,
  hoje: string,
  acc: Contagem,
  problemas: string[],
): Promise<void> {
  let texto: string;
  try {
    const resp = await fetch(fonte.referencia, { cache: "no-store" });
    if (!resp.ok) {
      problemas.push(`iCal ${fonte.tipo}: HTTP ${resp.status}`);
      return;
    }
    texto = await resp.text();
  } catch {
    problemas.push(`iCal ${fonte.tipo}: falha ao obter o calendário`);
    return;
  }

  const canal = canalDeFonteIcal(fonte.tipo);
  const eventos = parseIcs(texto).filter(
    (e) => e.inicio && !ehBloqueio(e.resumo),
  );
  const uidsFeed = new Set(eventos.map((e) => e.uid));

  // Reservas já existentes desta casa que vieram de iCal.
  const { data: existentesData } = await supabase
    .from("reservas")
    .select("id, ical_uid, fonte, estado, data_checkin, editada_manual")
    .eq("casa_id", fonte.casa_id)
    .not("ical_uid", "is", null);
  const existentes = (existentesData ?? []) as {
    id: string;
    ical_uid: string;
    fonte: string | null;
    estado: string;
    data_checkin: string | null;
    editada_manual: boolean;
  }[];
  const porUid = new Map(existentes.map((r) => [r.ical_uid, r]));

  const novas: Record<string, unknown>[] = [];

  for (const ev of eventos) {
    const hospede = nomeHospede(ev.resumo, ev.descricao);
    const existente = porUid.get(ev.uid);

    if (existente) {
      if (existente.editada_manual) continue; // edição do utilizador manda
      const update: Record<string, unknown> = {
        data_checkin: ev.inicio,
        data_checkout: ev.fim,
        fonte: fonte.tipo,
        canal,
        estado: "ativa",
      };
      if (hospede) update.hospede = hospede;
      const { error } = await supabase
        .from("reservas")
        .update(update)
        .eq("id", existente.id);
      if (error) problemas.push(`iCal update: ${error.message}`);
      else acc.atualizadas++;
    } else {
      novas.push({
        org_id: org,
        casa_id: fonte.casa_id,
        canal,
        fonte: fonte.tipo,
        ical_uid: ev.uid,
        data_checkin: ev.inicio,
        data_checkout: ev.fim,
        hospede,
        estado: "ativa",
        editada_manual: false,
      });
    }
  }

  if (novas.length > 0) {
    const { data: ins, error } = await supabase
      .from("reservas")
      .insert(novas)
      .select("id");
    if (error) problemas.push(`iCal insert: ${error.message}`);
    else acc.novas += ins?.length ?? 0;
  }

  // Cancelamento: reservas FUTURAS desta fonte que sumiram do feed.
  const aCancelar = existentes
    .filter(
      (r) =>
        r.fonte === fonte.tipo &&
        r.estado === "ativa" &&
        !r.editada_manual &&
        !uidsFeed.has(r.ical_uid) &&
        r.data_checkin !== null &&
        r.data_checkin >= hoje,
    )
    .map((r) => r.id);
  if (aCancelar.length > 0) {
    const { error } = await supabase
      .from("reservas")
      .update({ estado: "cancelada" })
      .in("id", aCancelar);
    if (error) problemas.push(`iCal cancelar: ${error.message}`);
    else acc.canceladas += aCancelar.length;
  }
}

/* ------------------------------------------------------------------ */
/* Lodgify (API) — corre só no servidor (LODGIFY_API_KEY)              */
/* ------------------------------------------------------------------ */

function canalLodgify(origem: string): string {
  const o = (origem || "").toLowerCase();
  if (o.includes("airbnb")) return "airbnb";
  if (o.includes("vrbo") || o.includes("homeaway")) return "vrbo";
  if (o.includes("manual") || o.includes("direct") || o.includes("website"))
    return "proprio";
  return "outro";
}

/** Vai buscar TODAS as bookings do Lodgify (paginado). */
async function obterBookingsLodgify(
  apiKey: string,
  problemas: string[],
): Promise<Record<string, unknown>[] | null> {
  const todas: Record<string, unknown>[] = [];
  let page = 1;
  const size = 50;
  for (let i = 0; i < 100; i++) {
    // stayFilter=All traz passadas + futuras (a omissão só dá as próximas);
    // a janela de datas é aplicada no servidor por `arrival`.
    const url = `https://api.lodgify.com/v2/reservations/bookings?includeTransactions=true&includeQuoteDetails=true&stayFilter=All&page=${page}&size=${size}`;
    let json: unknown;
    try {
      const resp = await fetch(url, {
        headers: { "X-ApiKey": apiKey, Accept: "application/json" },
        cache: "no-store",
      });
      if (!resp.ok) {
        problemas.push(`Lodgify: HTTP ${resp.status}`);
        return todas.length > 0 ? todas : null;
      }
      json = await resp.json();
    } catch (e) {
      problemas.push(`Lodgify: ${String(e)}`);
      return todas.length > 0 ? todas : null;
    }
    const lote: Record<string, unknown>[] = Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : (((json as Record<string, unknown>)?.items as Record<
          string,
          unknown
        >[]) ?? []);
    todas.push(...lote);
    if (lote.length < size) break;
    page++;
  }
  return todas;
}

function campo(obj: Record<string, unknown>, ...nomes: string[]): unknown {
  for (const n of nomes) {
    if (obj[n] !== undefined && obj[n] !== null) return obj[n];
  }
  return undefined;
}

const arred2 = (n: number) => Math.round(n * 100) / 100;

async function sincronizarLodgify(
  supabase: SupabaseClient,
  org: string,
  fontes: Fonte[],
  hoje: string,
  acc: Contagem,
  problemas: string[],
  taxasCanal: Record<string, number>,
  ivaPorCasa: Record<string, number>,
  desde: string,
): Promise<void> {
  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) {
    problemas.push("Lodgify: LODGIFY_API_KEY não definida no servidor.");
    return;
  }

  const bookings = await obterBookingsLodgify(apiKey, problemas);
  if (!bookings) return;

  for (const fonte of fontes) {
    const propId = String(fonte.referencia);
    const doImovel = bookings.filter((b) => {
      if (String(campo(b, "property_id", "propertyId") ?? "") !== propId) {
        return false;
      }
      // Só importa estadias com chegada a partir da janela (`desde`).
      const arrival = String(
        campo(b, "arrival", "date_arrival", "checkIn") ?? "",
      ).slice(0, 10);
      return arrival >= desde;
    });
    const idsFeed = new Set<string>();

    // Existentes desta casa vindas do Lodgify.
    const { data: existentesData } = await supabase
      .from("reservas")
      .select("id, externo_id, estado, data_checkin, editada_manual")
      .eq("casa_id", fonte.casa_id)
      .eq("fonte", "lodgify_api")
      .not("externo_id", "is", null);
    const existentes = (existentesData ?? []) as {
      id: string;
      externo_id: string;
      estado: string;
      data_checkin: string | null;
      editada_manual: boolean;
    }[];
    const porId = new Map(existentes.map((r) => [r.externo_id, r]));

    for (const b of doImovel) {
      const externoId = String(campo(b, "id") ?? "");
      if (!externoId) continue;

      // Na Lodgify só "Booked" é reserva confirmada; "Open" é um pedido
      // (enquiry, como um pedido de esclarecimento) e "Declined" é recusado —
      // nenhum é reserva, por isso ignoram-se (não entram nem ficam no feed).
      const status = String(campo(b, "status") ?? "").toLowerCase();
      if (!status.includes("booked")) continue;

      idsFeed.add(externoId);

      const checkin = (campo(b, "arrival", "date_arrival", "checkIn") ??
        null) as string | null;
      const checkout = (campo(b, "departure", "date_departure", "checkOut") ??
        null) as string | null;
      // No Lodgify v2: `source` é o canal real (ex.: "AirbnbIntegration");
      // `source_text` é um JSON com metadados, não serve para canal.
      const origem = String(campo(b, "source", "origin", "channel") ?? "");
      const nome = String(
        (campo(b, "guest") as Record<string, unknown> | undefined)?.name ??
          campo(b, "guest_name") ??
          "",
      );
      const valor = Number(
        campo(b, "total_amount", "totalAmount", "amount", "total") ?? 0,
      );
      // Reserva confirmada mas cancelada/apagada na Lodgify → estado cancelada.
      const cancelada =
        campo(b, "canceled_at") != null || campo(b, "is_deleted") === true;

      const existente = porId.get(externoId);
      if (existente?.editada_manual) continue; // edição do utilizador manda

      const valorOk = Number.isFinite(valor) ? valor : 0;
      const canal = canalLodgify(origem);
      // Propõe taxa do canal (% sobre o valor) e IVA (incluído no preço).
      const taxaPct = taxasCanal[canal] ?? 0;
      const taxaCanal = arred2((valorOk * taxaPct) / 100);
      const ivaPct = ivaPorCasa[fonte.casa_id] ?? 0;
      const ivaLiquidado =
        ivaPct > 0 ? arred2((valorOk * ivaPct) / (100 + ivaPct)) : 0;

      const dados: Record<string, unknown> = {
        canal,
        fonte: "lodgify_api",
        data_checkin: checkin ? String(checkin).slice(0, 10) : null,
        data_checkout: checkout ? String(checkout).slice(0, 10) : null,
        hospede: nome.trim() || null,
        valor_total: valorOk,
        taxa_canal: taxaCanal,
        iva_liquidado: ivaLiquidado,
        estado: cancelada ? "cancelada" : "ativa",
      };

      if (existente) {
        const { error } = await supabase
          .from("reservas")
          .update(dados)
          .eq("id", existente.id);
        if (error) problemas.push(`Lodgify update: ${error.message}`);
        else acc.atualizadas++;
      } else {
        const { error } = await supabase.from("reservas").insert({
          org_id: org,
          casa_id: fonte.casa_id,
          externo_id: externoId,
          editada_manual: false,
          ...dados,
        });
        if (error) problemas.push(`Lodgify insert: ${error.message}`);
        else acc.novas++;
      }
    }

    // Cancelamento de futuras que sumiram do feed.
    const aCancelar = existentes
      .filter(
        (r) =>
          r.estado === "ativa" &&
          !r.editada_manual &&
          !idsFeed.has(r.externo_id) &&
          r.data_checkin !== null &&
          r.data_checkin >= hoje,
      )
      .map((r) => r.id);
    if (aCancelar.length > 0) {
      const { error } = await supabase
        .from("reservas")
        .update({ estado: "cancelada" })
        .in("id", aCancelar);
      if (error) problemas.push(`Lodgify cancelar: ${error.message}`);
      else acc.canceladas += aCancelar.length;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Ação principal                                                      */
/* ------------------------------------------------------------------ */

/** Data (YYYY-MM-DD) de há um mês, para a janela por defeito da sincronização. */
function umMesAtras(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export async function sincronizarAction(
  _prev: SyncState,
  formData: FormData,
): Promise<SyncState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const org = sessao.orgId;

  // Janela do Lodgify: por defeito de há 1 mês até ao futuro; o botão de
  // histórico envia "2026-01-01" para o backfill único do ano.
  const desdeForm = String(formData.get("desde") ?? "");
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(desdeForm) ? desdeForm : umMesAtras();

  const supabase = await createClient();
  const { data: fontesData, error } = await supabase
    .from("fontes_reserva")
    .select("id, casa_id, tipo, referencia, ativo")
    .eq("ativo", true);
  if (error) return { error: error.message };

  const fontes = (fontesData ?? []) as (Fonte & { ativo: boolean })[];
  if (fontes.length === 0) {
    return { error: "Não há fontes de reserva ativas (configura em Casas)." };
  }

  const hoje = hojeISO();
  const acc: Contagem = { novas: 0, atualizadas: 0, canceladas: 0 };
  const problemas: string[] = [];

  for (const fonte of fontes) {
    if (fonte.tipo === "lodgify_api") continue; // tratadas em conjunto abaixo
    await importarIcal(supabase, org, fonte, hoje, acc, problemas);
  }

  const fontesLodgify = fontes.filter((f) => f.tipo === "lodgify_api");
  if (fontesLodgify.length > 0) {
    // Percentagens parametrizadas para propor taxa do canal e IVA.
    const [{ data: taxasData }, { data: casasData }] = await Promise.all([
      supabase.from("taxas_canal").select("canal, percentagem"),
      supabase.from("casas").select("id, iva_percentagem"),
    ]);
    const taxasCanal: Record<string, number> = {};
    for (const t of (taxasData ?? []) as {
      canal: string;
      percentagem: number;
    }[]) {
      taxasCanal[t.canal] = Number(t.percentagem);
    }
    const ivaPorCasa: Record<string, number> = {};
    for (const c of (casasData ?? []) as {
      id: string;
      iva_percentagem: number;
    }[]) {
      ivaPorCasa[c.id] = Number(c.iva_percentagem);
    }
    await sincronizarLodgify(
      supabase,
      org,
      fontesLodgify,
      hoje,
      acc,
      problemas,
      taxasCanal,
      ivaPorCasa,
      desde,
    );
  }

  revalidatePath("/reservas");
  revalidatePath("/cc");

  const resumo = `${acc.novas} nova(s), ${acc.atualizadas} atualizada(s), ${acc.canceladas} cancelada(s).`;
  if (problemas.length > 0) {
    return { error: `${resumo} Problemas: ${problemas.join("; ")}` };
  }
  return {
    mensagem: `Sincronização concluída: ${resumo} Confere os valores antes de lançar.`,
  };
}

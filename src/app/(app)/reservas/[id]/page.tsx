import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { FormularioReserva } from "@/components/FormularioReserva";
import {
  apagarReservaAction,
  desvalidarReservaAction,
} from "@/lib/actions/reservas";
import { DocumentosEntidade } from "@/components/DocumentosEntidade";
import { documentosDaEntidade } from "@/lib/documentos";
import { CANAL_LABEL } from "@/lib/canais";
import type { Reserva } from "@/lib/types";

export const metadata = { title: "Editar reserva · Sopro" };

export default async function EditarReservaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("reservas")
    .select(
      "id, casa_id, canal, data_checkin, data_checkout, valor_total, iva_liquidado, faturado, taxa_canal, comissao_stripe, liquido, fora_sopro, ical_uid, externo_id, fonte, hospede, estado, editada_manual, validada, recebido, data_recebimento, valor_recebido",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const r = data as Reserva;

  const [{ data: casasData }, { data: centrosData }, { data: taxasData }] =
    await Promise.all([
      supabase
        .from("casas")
        .select("id, nome, centro_custo_id, iva_percentagem")
        .order("nome"),
      supabase.from("centros_custo").select("id, nome"),
      supabase.from("taxas_canal").select("canal, percentagem"),
    ]);
  const centros = (centrosData ?? []) as { id: string; nome: string }[];
  const ccNome = new Map(centros.map((c) => [c.id, c.nome]));
  const casasRaw = (casasData ?? []) as {
    id: string;
    nome: string;
    centro_custo_id: string;
    iva_percentagem: number;
  }[];
  const casas = casasRaw.map((c) => ({
    id: c.id,
    nome: c.nome,
    ccNome: ccNome.get(c.centro_custo_id) ?? "—",
  }));
  const taxasPorCanal: Record<string, number> = {};
  for (const t of (taxasData ?? []) as { canal: string; percentagem: number }[]) {
    taxasPorCanal[t.canal] = Number(t.percentagem);
  }
  const ivasPorCasa: Record<string, number> = {};
  for (const c of casasRaw) ivasPorCasa[c.id] = Number(c.iva_percentagem);
  const docs = await documentosDaEntidade(supabase, "reserva", r.id);

  const inicial = {
    casa_id: r.casa_id,
    canal: r.canal ?? "",
    data_checkin: r.data_checkin ?? "",
    data_checkout: r.data_checkout ?? "",
    valor_total: String(r.valor_total ?? 0),
    iva_liquidado: String(r.iva_liquidado ?? 0),
    taxa_canal: String(r.taxa_canal ?? 0),
    comissao_stripe: String(r.comissao_stripe ?? 0),
    faturado: !!r.faturado,
    fora_sopro: !!r.fora_sopro,
    hospede: r.hospede ?? "",
    estado: r.estado ?? "ativa",
    recebido: !!r.recebido,
    data_recebimento: r.data_recebimento ?? "",
    valor_recebido: r.valor_recebido != null ? String(r.valor_recebido) : "",
    validada: !!r.validada,
  };

  return (
    <div>
      <Link href="/reservas" className="al-back">
        ← Reservas
      </Link>
      <div className="al-head">
        <h1>
          Editar reserva
          <span className="al-tag">
            {r.validada ? "fechada" : "rascunho"}
          </span>
          {r.fonte && (
            <span className="al-tag">
              importada · {CANAL_LABEL[r.canal ?? ""] ?? r.canal}
            </span>
          )}
        </h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {r.validada && (
            <form action={desvalidarReservaAction}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" className="al-back" style={{ padding: "9px 0" }}>
                Desvalidar
              </button>
            </form>
          )}
          <form action={apagarReservaAction}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="al-back" style={{ padding: "9px 0" }}>
              Apagar reserva
            </button>
          </form>
        </div>
      </div>
      <div className="al-card" style={{ padding: 20 }}>
        <FormularioReserva
          casas={casas}
          modo="editar"
          reservaId={r.id}
          inicial={inicial}
          taxasPorCanal={taxasPorCanal}
          ivasPorCasa={ivasPorCasa}
        />
      </div>

      <h2 className="al-h2">Documentos</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <DocumentosEntidade entidadeTipo="reserva" entidadeId={r.id} docs={docs} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { BotaoSincronizar } from "@/components/BotaoSincronizar";
import { TabelaReservas, type ReservaVw } from "@/components/TabelaReservas";

export const metadata = { title: "Reservas · Sopro" };

export default async function ReservasPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Reservas</h1>
        </div>
        <div className="al-card" style={{ padding: 24 }}>
          <p className="al-hint" style={{ margin: 0 }}>
            Sem organização associada.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_reservas")
    .select(
      "id, casa, centro, canal, hospede, data_checkin, data_checkout, valor_total, iva_liquidado, liquido, faturado, fora_sopro, validada, estado, estado_temporal",
    )
    .order("data_checkin", { ascending: false, nullsFirst: false });

  const reservas = (data ?? []) as ReservaVw[];

  return (
    <div>
      <div className="al-head">
        <h1>Reservas</h1>
        <Link href="/reservas/nova" className="al-btn">
          Registar reserva
        </Link>
      </div>

      <div
        className="al-card"
        style={{
          padding: 16,
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <BotaoSincronizar />
        <span className="al-hint" style={{ margin: 0 }}>
          Importa de Airbnb/VRBO (iCal) e Lodgify. As reservas importadas entram
          como rascunho; confere os valores e valida.
        </span>
      </div>

      <TabelaReservas reservas={reservas} />
    </div>
  );
}

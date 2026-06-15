import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { FormularioReserva } from "@/components/FormularioReserva";

export const metadata = { title: "Nova reserva · Sopro" };

export default async function NovaReservaPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <Link href="/reservas" className="al-back">
          ← Reservas
        </Link>
        <div className="al-card" style={{ padding: 24 }}>
          <p className="al-hint" style={{ margin: 0 }}>
            Sem organização associada.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: casasData }, { data: centrosData }] = await Promise.all([
    supabase
      .from("casas")
      .select("id, nome, centro_custo_id, iva_percentagem")
      .order("nome"),
    supabase.from("centros_custo").select("id, nome"),
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
  const ivasPorCasa: Record<string, number> = {};
  for (const c of casasRaw) ivasPorCasa[c.id] = Number(c.iva_percentagem);

  return (
    <div>
      <Link href="/reservas" className="al-back">
        ← Reservas
      </Link>
      <div className="al-head">
        <h1>Nova reserva</h1>
      </div>
      <div className="al-card" style={{ padding: 20 }}>
        <FormularioReserva casas={casas} modo="criar" ivasPorCasa={ivasPorCasa} />
      </div>
    </div>
  );
}

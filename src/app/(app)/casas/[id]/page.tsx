import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { FormularioCasa } from "@/components/FormularioCasa";
import { GestaoFontes } from "@/components/GestaoFontes";
import type { FonteReserva } from "@/lib/types";

export const metadata = { title: "Editar casa · Sopro" };

export default async function EditarCasaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("casas")
    .select("id, nome, morada, centro_custo_id, peso_base, iva_percentagem")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const casa = data as {
    id: string;
    nome: string;
    morada: string | null;
    centro_custo_id: string;
    peso_base: number;
    iva_percentagem: number;
  };

  const [{ data: centrosData }, { data: fontesData }] = await Promise.all([
    supabase.from("centros_custo").select("id, nome").order("ordem"),
    supabase
      .from("fontes_reserva")
      .select("id, casa_id, tipo, referencia, ativo")
      .eq("casa_id", id)
      .order("criado_em"),
  ]);
  const centros = (centrosData ?? []) as { id: string; nome: string }[];
  const fontes = (fontesData ?? []) as FonteReserva[];

  return (
    <div>
      <Link href="/casas" className="al-back">
        ← Casas
      </Link>
      <div className="al-head">
        <h1>{casa.nome}</h1>
      </div>
      <div className="al-card" style={{ padding: 20 }}>
        <FormularioCasa
          centros={centros}
          modo="editar"
          casaId={casa.id}
          inicial={{
            nome: casa.nome,
            morada: casa.morada ?? "",
            centro_custo_id: casa.centro_custo_id,
            peso_base: String(casa.peso_base ?? 0),
            iva_percentagem: String(casa.iva_percentagem ?? 0),
          }}
        />
      </div>

      <h2 className="al-h2">Fontes de reserva (importação)</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <GestaoFontes casaId={casa.id} fontes={fontes} />
      </div>
    </div>
  );
}

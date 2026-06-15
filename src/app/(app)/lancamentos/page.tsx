import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import {
  TabelaLancamentos,
  type LancLinha,
} from "@/components/TabelaLancamentos";

export const metadata = { title: "Lançamentos · Sopro" };

export default async function LancamentosPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Lançamentos</h1>
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
  const [{ data: lancData }, { data: centrosData }, { data: casasData }] =
    await Promise.all([
      supabase
        .from("lancamentos")
        .select(
          "id, data, centro_custo_id, casa_id, conta, valor, origem, origem_id, descricao",
        )
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(3000),
      supabase.from("centros_custo").select("id, nome"),
      supabase.from("casas").select("id, nome"),
    ]);

  const ccNome = new Map(
    ((centrosData ?? []) as { id: string; nome: string }[]).map((c) => [
      c.id,
      c.nome,
    ]),
  );
  const casaNome = new Map(
    ((casasData ?? []) as { id: string; nome: string }[]).map((c) => [
      c.id,
      c.nome,
    ]),
  );

  const lancamentos: LancLinha[] = (
    (lancData ?? []) as {
      id: string;
      data: string;
      centro_custo_id: string;
      casa_id: string | null;
      conta: string;
      valor: number;
      origem: string | null;
      origem_id: string | null;
      descricao: string | null;
    }[]
  ).map((l) => ({
    id: l.id,
    data: l.data,
    cc: ccNome.get(l.centro_custo_id) ?? "—",
    casa: l.casa_id ? (casaNome.get(l.casa_id) ?? "—") : "",
    conta: l.conta,
    valor: Number(l.valor),
    descricao: l.descricao ?? "",
    origem: l.origem ?? "",
    origem_id: l.origem_id,
  }));

  return (
    <div>
      <div className="al-head">
        <h1>Lançamentos</h1>
      </div>
      <TabelaLancamentos lancamentos={lancamentos} />
    </div>
  );
}

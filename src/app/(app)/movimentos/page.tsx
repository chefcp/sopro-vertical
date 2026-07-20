import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Movimentos, type Movimento, type MovLeg } from "@/components/Movimentos";

export const metadata = { title: "Movimentos · Sopro" };

type LancRow = {
  id: string;
  data: string;
  centro_custo_id: string;
  casa_id: string | null;
  conta: string;
  valor: number;
  origem: string | null;
  origem_id: string | null;
  lote: string | null;
  descricao: string | null;
  editado_manual: boolean;
};

export default async function MovimentosPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Movimentos</h1>
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
  const [
    { data: lancData },
    { data: centrosData },
    { data: casasData },
    { data: custosData },
    { data: reservasData },
  ] = await Promise.all([
    supabase
      .from("lancamentos")
      .select(
        "id, data, centro_custo_id, casa_id, conta, valor, origem, origem_id, lote, descricao, editado_manual",
      )
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(5000),
    supabase.from("centros_custo").select("id, nome").order("ordem"),
    supabase.from("casas").select("id, nome, centro_custo_id").order("nome"),
    supabase.from("custos").select("id, fornecedor"),
    supabase.from("reservas").select("id, casa_id, data_checkin, hospede"),
  ]);

  const centros = (centrosData ?? []) as { id: string; nome: string }[];
  const casas = (casasData ?? []) as {
    id: string;
    nome: string;
    centro_custo_id: string;
  }[];
  const ccNome = new Map(centros.map((c) => [c.id, c.nome]));
  const casaNome = new Map(casas.map((c) => [c.id, c.nome]));
  const fornecedorDe = new Map(
    ((custosData ?? []) as { id: string; fornecedor: string }[]).map((c) => [
      c.id,
      c.fornecedor,
    ]),
  );
  const reservaDe = new Map(
    (
      (reservasData ?? []) as {
        id: string;
        casa_id: string;
        data_checkin: string;
        hospede: string | null;
      }[]
    ).map((r) => [r.id, r]),
  );

  const rows = (lancData ?? []) as LancRow[];

  // Agrupa por "movimento": origem+origem_id, ou lote, ou a própria linha.
  const chaveDe = (l: LancRow) =>
    l.origem_id
      ? `${l.origem}:${l.origem_id}`
      : l.lote
        ? `lote:${l.lote}`
        : `id:${l.id}`;

  const grupos = new Map<string, LancRow[]>();
  for (const l of rows) {
    const k = chaveDe(l);
    const arr = grupos.get(k);
    if (arr) arr.push(l);
    else grupos.set(k, [l]);
  }

  const tituloDe = (ls: LancRow[]): string => {
    const l = ls[0];
    if (l.origem === "custo" && l.origem_id) {
      return fornecedorDe.get(l.origem_id) ?? "Custo";
    }
    if (l.origem === "reserva" && l.origem_id) {
      const r = reservaDe.get(l.origem_id);
      const casa = r ? (casaNome.get(r.casa_id) ?? "") : "";
      const quem = r?.hospede ? ` · ${r.hospede}` : "";
      return `Reserva ${casa}${quem}`.trim();
    }
    // manual / pagamento / suprimento — usa a descrição comum.
    return l.descricao ?? "Movimento";
  };

  const movimentos: Movimento[] = [...grupos.values()].map((ls) => {
    const legs: MovLeg[] = ls.map((l) => ({
      id: l.id,
      conta: l.conta,
      cc: ccNome.get(l.centro_custo_id) ?? "—",
      cc_id: l.centro_custo_id,
      casa: l.casa_id ? (casaNome.get(l.casa_id) ?? "—") : "",
      casa_id: l.casa_id,
      valor: Number(l.valor),
      descricao: l.descricao ?? "",
    }));
    const soma = (conta: string) =>
      legs.filter((x) => x.conta === conta).reduce((s, x) => s + x.valor, 0);
    const datas = ls.map((l) => l.data).filter(Boolean).sort();
    return {
      key: chaveDe(ls[0]),
      ref_id: ls[0].id,
      data: datas[0] ?? ls[0].data,
      titulo: tituloDe(ls),
      origem: ls[0].origem ?? "manual",
      origem_id: ls[0].origem_id,
      locked: ls.some((l) => l.editado_manual),
      impacto_resultado: Math.round(soma("resultado") * 100) / 100,
      impacto_tesouraria: Math.round(soma("tesouraria") * 100) / 100,
      legs,
    };
  });

  movimentos.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  return (
    <div>
      <div className="al-head">
        <h1>Movimentos</h1>
      </div>
      <Movimentos movimentos={movimentos} centros={centros} casas={casas} />
    </div>
  );
}

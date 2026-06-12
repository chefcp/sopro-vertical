import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { TabelaCustos, type CustoLinha } from "@/components/TabelaCustos";
import type { Custo } from "@/lib/types";

export const metadata = { title: "Custos · Sopro" };

export default async function CustosPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Custos</h1>
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
    { data: custosData },
    { data: centrosData },
    { data: pessoasData },
    { data: casasData },
    { data: alocData },
    { data: docsData },
  ] = await Promise.all([
    supabase
      .from("custos")
      .select(
        "id, fornecedor, descricao, data, valor_base, iva, total, pago_por_tipo, pago_por_pessoa_id, pago_por_cc_id",
      )
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false }),
    supabase.from("centros_custo").select("id, nome").order("ordem"),
    supabase.from("pessoas").select("id, nome").order("nome"),
    supabase.from("casas").select("id, nome").order("nome"),
    supabase.from("alocacoes").select("custo_id, centro_custo_id, casa_id"),
    supabase.from("documentos").select("entidade_id").eq("entidade_tipo", "custo"),
  ]);

  const centros = (centrosData ?? []) as { id: string; nome: string }[];
  const pessoas = (pessoasData ?? []) as { id: string; nome: string }[];
  const casas = (casasData ?? []) as { id: string; nome: string }[];
  const ccNome = new Map(centros.map((c) => [c.id, c.nome]));
  const casaNome = new Map(casas.map((c) => [c.id, c.nome]));
  const pessoaNome = new Map(pessoas.map((p) => [p.id, p.nome]));

  // Alocações por custo: nomes/ids de CC e casa.
  const aloc = new Map<
    string,
    { ccIds: Set<string>; casaIds: Set<string> }
  >();
  for (const a of (alocData ?? []) as {
    custo_id: string;
    centro_custo_id: string;
    casa_id: string | null;
  }[]) {
    const e = aloc.get(a.custo_id) ?? {
      ccIds: new Set<string>(),
      casaIds: new Set<string>(),
    };
    if (a.centro_custo_id) e.ccIds.add(a.centro_custo_id);
    if (a.casa_id) e.casaIds.add(a.casa_id);
    aloc.set(a.custo_id, e);
  }

  const comDoc = new Set(
    ((docsData ?? []) as { entidade_id: string }[]).map((d) => d.entidade_id),
  );

  const pagoPor = (c: Custo) => {
    if (c.pago_por_tipo === "sopro") return "Sopro";
    if (c.pago_por_tipo === "pessoa")
      return pessoaNome.get(c.pago_por_pessoa_id ?? "") ?? "Pessoa";
    return ccNome.get(c.pago_por_cc_id ?? "") ?? "CC";
  };

  const custos: CustoLinha[] = ((custosData ?? []) as Custo[]).map((c) => {
    const e = aloc.get(c.id);
    const ccIds = e ? [...e.ccIds] : [];
    const casaIds = e ? [...e.casaIds] : [];
    return {
      id: c.id,
      fornecedor: c.fornecedor,
      descricao: c.descricao,
      data: c.data,
      valor_base: Number(c.valor_base),
      iva: Number(c.iva),
      total: Number(c.total ?? Number(c.valor_base) + Number(c.iva)),
      pago_por: pagoPor(c),
      centros: ccIds.map((id) => ccNome.get(id) ?? "—").join(", "),
      centro_ids: ccIds,
      casas: casaIds.map((id) => casaNome.get(id) ?? "—").join(", "),
      casa_ids: casaIds,
      tem_doc: comDoc.has(c.id),
    };
  });

  return (
    <div>
      <div className="al-head">
        <h1>Custos</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/custos/importar" className="al-btn">
            Importar faturas
          </Link>
          <Link href="/custos/nova" className="al-btn">
            Registar custo
          </Link>
        </div>
      </div>

      <TabelaCustos custos={custos} centros={centros} casas={casas} />
    </div>
  );
}

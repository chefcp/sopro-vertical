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

  const [{ data: custosData }, { data: centrosData }, { data: pessoasData }] =
    await Promise.all([
      supabase
        .from("custos")
        .select(
          "id, fornecedor, descricao, data, valor_base, iva, total, pago_por_tipo, pago_por_pessoa_id, pago_por_cc_id",
        )
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false }),
      supabase.from("centros_custo").select("id, nome").order("ordem"),
      supabase.from("pessoas").select("id, nome").order("nome"),
    ]);

  const centros = (centrosData ?? []) as { id: string; nome: string }[];
  const pessoas = (pessoasData ?? []) as { id: string; nome: string }[];
  const ccNome = new Map(centros.map((c) => [c.id, c.nome]));
  const pessoaNome = new Map(pessoas.map((p) => [p.id, p.nome]));

  const pagoPor = (c: Custo) => {
    if (c.pago_por_tipo === "sopro") return "Sopro";
    if (c.pago_por_tipo === "pessoa")
      return pessoaNome.get(c.pago_por_pessoa_id ?? "") ?? "Pessoa";
    return ccNome.get(c.pago_por_cc_id ?? "") ?? "CC";
  };

  const custos: CustoLinha[] = ((custosData ?? []) as Custo[]).map((c) => ({
    id: c.id,
    fornecedor: c.fornecedor,
    descricao: c.descricao,
    data: c.data,
    valor_base: Number(c.valor_base),
    iva: Number(c.iva),
    total: Number(c.total ?? Number(c.valor_base) + Number(c.iva)),
    pago_por: pagoPor(c),
  }));

  return (
    <div>
      <div className="al-head">
        <h1>Custos</h1>
        <Link href="/custos/nova" className="al-btn">
          Registar custo
        </Link>
      </div>

      <TabelaCustos custos={custos} />
    </div>
  );
}

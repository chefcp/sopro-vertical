import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Valor, ValorIva } from "@/components/Valor";
import { LinhaClicavel } from "@/components/LinhaClicavel";
import { eur, dataPt } from "@/lib/format";
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

  const custos = (custosData ?? []) as Custo[];
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

  return (
    <div>
      <div className="al-head">
        <h1>Custos</h1>
        <Link href="/custos/nova" className="al-btn">
          Registar custo
        </Link>
      </div>

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Data</th>
              <th className="al-r">Valor base</th>
              <th className="al-r">IVA</th>
              <th className="al-r">Total</th>
              <th>Pago por</th>
            </tr>
          </thead>
          <tbody>
            {custos.map((c) => (
              <LinhaClicavel key={c.id} href={`/custos/${c.id}`}>
                <td>
                  <span className="al-cc-nome">{c.fornecedor}</span>
                  {c.descricao && (
                    <span className="al-dim" style={{ marginLeft: 8 }}>
                      {c.descricao}
                    </span>
                  )}
                </td>
                <td className="al-mono">{dataPt(c.data)}</td>
                <td className="al-r">
                  <Valor n={-Number(c.valor_base)} />
                </td>
                <td className="al-r">
                  <ValorIva n={Number(c.iva)} />
                </td>
                <td className="al-r">
                  <span className="al-num">
                    {eur(c.total ?? Number(c.valor_base) + Number(c.iva))}
                  </span>
                </td>
                <td>{pagoPor(c)}</td>
              </LinhaClicavel>
            ))}
            {custos.length === 0 && (
              <tr>
                <td colSpan={6} className="al-hint" style={{ padding: 24 }}>
                  Ainda não há custos registados. Carrega em &quot;Registar
                  custo&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="al-hint">
        Carrega num custo para editar ou apagar. Cada custo é repartido por
        centros de custo / casas (alocações) e lançado no livro.
      </p>
    </div>
  );
}

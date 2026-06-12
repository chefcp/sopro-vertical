import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Valor, ValorIva } from "@/components/Valor";
import { LinhaClicavel } from "@/components/LinhaClicavel";
import type { ResumoCasa } from "@/lib/types";

export const metadata = { title: "Casas · Sopro" };

export default async function CasasPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Casas</h1>
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
  const [{ data: casasData }, { data: centrosData }] = await Promise.all([
    supabase
      .from("vw_resumo_casa")
      .select("casa_id, nome, centro_custo_id, peso_base, resultado, saldo_iva")
      .order("nome"),
    supabase.from("centros_custo").select("id, nome"),
  ]);

  const casas = (casasData ?? []) as ResumoCasa[];
  const ccNome = new Map(
    ((centrosData ?? []) as { id: string; nome: string }[]).map((c) => [
      c.id,
      c.nome,
    ]),
  );

  return (
    <div>
      <div className="al-head">
        <h1>Casas</h1>
        <Link href="/casas/nova" className="al-btn">
          Nova casa
        </Link>
      </div>

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Casa</th>
              <th>Centro de custo</th>
              <th className="al-r">Peso</th>
              <th className="al-r">Resultado</th>
              <th className="al-r">Saldo IVA</th>
            </tr>
          </thead>
          <tbody>
            {casas.map((c) => (
              <LinhaClicavel key={c.casa_id} href={`/casas/${c.casa_id}`}>
                <td>
                  <span className="al-cc-nome">{c.nome}</span>
                </td>
                <td className="al-dim">{ccNome.get(c.centro_custo_id) ?? "—"}</td>
                <td className="al-r al-num al-dim">{Number(c.peso_base)}%</td>
                <td className="al-r">
                  <Valor
                    n={Number(c.resultado)}
                    forte={Number(c.resultado) >= 0}
                  />
                </td>
                <td className="al-r">
                  <ValorIva n={Number(c.saldo_iva)} />
                </td>
              </LinhaClicavel>
            ))}
            {casas.length === 0 && (
              <tr>
                <td colSpan={5} className="al-hint" style={{ padding: 24 }}>
                  Ainda não há casas. Carrega em &quot;Nova casa&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="al-hint">Carrega numa casa para editar.</p>
    </div>
  );
}

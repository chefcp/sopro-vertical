import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Kpi } from "@/components/Kpi";
import { Valor, ValorIva } from "@/components/Valor";
import { LinhaClicavel } from "@/components/LinhaClicavel";
import { BotaoReembolsoIva } from "@/components/BotaoReembolsoIva";
import { eur } from "@/lib/format";
import type { ResumoCentroCusto } from "@/lib/types";

export const metadata = { title: "Centros de custo · Sopro" };

export default async function CentrosCustoPage() {
  const sessao = await getSessaoOrg();

  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Centros de custo</h1>
        </div>
        <div className="al-card" style={{ padding: 24 }}>
          <p className="al-hint" style={{ margin: 0 }}>
            A tua conta ainda não está ligada a nenhuma organização. Liga o
            utilizador à Sopro na tabela <span className="al-mono">membros</span>{" "}
            para veres os dados.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vw_resumo_centro_custo")
    .select(
      "centro_custo_id, nome, gera_faturacao, resultado, saldo_iva, saldo_suprimentos, saldo_tesouraria, saldo_cc_corrente, ordem",
    )
    .order("ordem")
    .order("nome");

  if (error) {
    return (
      <div>
        <div className="al-head">
          <h1>Centros de custo</h1>
        </div>
        <div className="al-card" style={{ padding: 24 }}>
          <p className="al-num al-neg" style={{ margin: 0, fontSize: 14 }}>
            Erro a carregar os dados: {error.message}
          </p>
        </div>
      </div>
    );
  }

  const ccs = (data ?? []) as ResumoCentroCusto[];

  const tot = ccs.reduce(
    (a, cc) => ({
      resultado: a.resultado + Number(cc.resultado),
      iva: a.iva + Number(cc.saldo_iva),
      sup: a.sup + Number(cc.saldo_suprimentos),
    }),
    { resultado: 0, iva: 0, sup: 0 },
  );

  return (
    <div>
      <div className="al-head">
        <h1>Centros de custo</h1>
        <BotaoReembolsoIva />
      </div>

      <div className="al-kpis">
        <Kpi label="Resultado acumulado">
          <Valor n={tot.resultado} forte={tot.resultado >= 0} />
        </Kpi>
        <Kpi label="Saldo de IVA a recuperar" iva>
          <ValorIva n={tot.iva} />
        </Kpi>
        <Kpi label="Suprimentos Totais">
          <span className="al-num">{eur(tot.sup)}</span>
        </Kpi>
        <Kpi label="Centros de custo">
          <span className="al-num">{ccs.length}</span>
        </Kpi>
      </div>

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Centro de custo</th>
              <th className="al-r">Resultado</th>
              <th className="al-r">Saldo IVA</th>
              <th className="al-r">Suprimentos</th>
              <th className="al-r">Tesouraria</th>
              <th className="al-r">Conta-corrente</th>
            </tr>
          </thead>
          <tbody>
            {ccs.map((cc) => (
              <CcRow key={cc.centro_custo_id} cc={cc} />
            ))}
            {ccs.length === 0 && (
              <tr>
                <td colSpan={6} className="al-hint" style={{ padding: 24 }}>
                  Ainda não há centros de custo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="al-hint">
        Carrega numa linha para ver as casas e as reservas do centro de custo.
      </p>
    </div>
  );
}

function CcRow({ cc }: { cc: ResumoCentroCusto }) {
  return (
    <LinhaClicavel href={`/cc/${cc.centro_custo_id}`}>
      <td>
        <span className="al-cc-nome">{cc.nome}</span>
        {!cc.gera_faturacao && <span className="al-tag">só custos</span>}
      </td>
      <td className="al-r">
        <Valor
          n={Number(cc.resultado)}
          forte={Number(cc.resultado) >= 0}
        />
      </td>
      <td className="al-r">
        <ValorIva n={Number(cc.saldo_iva)} />
      </td>
      <td className="al-r">
        <Valor
          n={Number(cc.saldo_suprimentos)}
          alarme="Suprimentos negativos: este CC consumiu suprimentos de outros."
        />
      </td>
      <td className="al-r">
        <Valor
          n={Number(cc.saldo_tesouraria)}
          alarme="Tesouraria negativa: este CC deve ao conjunto."
        />
      </td>
      <td className="al-r">
        <Valor
          n={Number(cc.saldo_cc_corrente)}
          alarme="Conta-corrente negativa: este CC deve a outro CC."
        />
      </td>
    </LinhaClicavel>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Kpi } from "@/components/Kpi";
import { Valor, ValorIva } from "@/components/Valor";
import { BotaoRedistribuir } from "@/components/BotaoRedistribuir";
import { BotaoPagarDono } from "@/components/BotaoPagarDono";
import { BotaoTransferir } from "@/components/BotaoTransferir";
import { eur, dataPt } from "@/lib/format";
import type {
  ResumoCentroCusto,
  ResumoCasa,
  Reserva,
  Lancamento,
} from "@/lib/types";

const CONTA_LABEL: Record<string, string> = {
  resultado: "Resultado",
  iva: "IVA",
  suprimentos: "Suprimentos",
  tesouraria: "Tesouraria",
  cc_corrente: "Conta-corrente",
};

export default async function DetalheCcPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) notFound();

  const supabase = await createClient();

  const { data: ccData } = await supabase
    .from("vw_resumo_centro_custo")
    .select(
      "centro_custo_id, nome, gera_faturacao, dono_id, resultado, saldo_iva, saldo_suprimentos, saldo_tesouraria, saldo_cc_corrente",
    )
    .eq("centro_custo_id", id)
    .maybeSingle();

  if (!ccData) notFound();
  const cc = ccData as ResumoCentroCusto;

  // Casas do CC (saldos da view)
  const { data: casasData } = await supabase
    .from("vw_resumo_casa")
    .select("casa_id, nome, centro_custo_id, peso_base, resultado, saldo_iva")
    .eq("centro_custo_id", id)
    .order("peso_base", { ascending: false });
  const casas = (casasData ?? []) as ResumoCasa[];
  const casaNome = new Map(casas.map((c) => [c.casa_id, c.nome]));
  const casaIds = casas.map((c) => c.casa_id);

  // Reservas das casas do CC
  let reservas: Reserva[] = [];
  const docsPorReserva = new Map<string, number>();
  if (casaIds.length > 0) {
    const { data: resData } = await supabase
      .from("reservas")
      .select(
        "id, casa_id, canal, data_checkin, data_checkout, valor_total, iva_liquidado, faturado, taxa_canal, comissao_stripe, liquido, fora_sopro",
      )
      .in("casa_id", casaIds)
      .order("data_checkin", { ascending: false });
    reservas = (resData ?? []) as Reserva[];

    const reservaIds = reservas.map((r) => r.id);
    if (reservaIds.length > 0) {
      const { data: docs } = await supabase
        .from("documentos")
        .select("entidade_id")
        .eq("entidade_tipo", "reserva")
        .in("entidade_id", reservaIds);
      for (const d of docs ?? []) {
        const k = (d as { entidade_id: string }).entidade_id;
        docsPorReserva.set(k, (docsPorReserva.get(k) ?? 0) + 1);
      }
    }
  }

  // Livro de lançamentos do CC
  const { data: lancData } = await supabase
    .from("lancamentos")
    .select("id, data, centro_custo_id, casa_id, conta, valor, origem, descricao")
    .eq("centro_custo_id", id)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(100);
  const lancamentos = (lancData ?? []) as Lancamento[];

  // Outros centros de custo (para transferir entre CCs)
  const { data: outrosData } = await supabase
    .from("centros_custo")
    .select("id, nome")
    .neq("id", id)
    .order("ordem");
  const outrosCentros = (outrosData ?? []) as { id: string; nome: string }[];

  return (
    <div>
      <Link href="/cc" className="al-back">
        ← Centros de custo
      </Link>
      <div className="al-head">
        <h1>
          {cc.nome}
          {!cc.gera_faturacao && <span className="al-tag">só custos</span>}
        </h1>
        <div style={{ display: "flex", gap: 10 }}>
          <BotaoRedistribuir cc={cc.centro_custo_id} />
          <BotaoPagarDono cc={cc.centro_custo_id} />
          <BotaoTransferir
            cc={cc.centro_custo_id}
            outrosCentros={outrosCentros}
          />
        </div>
      </div>

      <div className="al-kpis">
        <Kpi label="Resultado">
          <Valor n={Number(cc.resultado)} forte={Number(cc.resultado) >= 0} />
        </Kpi>
        <Kpi label="Saldo de IVA" iva>
          <ValorIva n={Number(cc.saldo_iva)} />
        </Kpi>
        <Kpi label="Suprimentos">
          <Valor
            n={Number(cc.saldo_suprimentos)}
            alarme="Suprimentos negativos: este CC consumiu suprimentos de outros."
          />
        </Kpi>
        <Kpi label="Tesouraria">
          <Valor
            n={Number(cc.saldo_tesouraria)}
            alarme="Tesouraria negativa: este CC deve ao conjunto."
          />
        </Kpi>
      </div>

      <h2 className="al-h2">Casas</h2>
      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Casa</th>
              <th className="al-r">Peso de repartição</th>
              <th className="al-r">Resultado</th>
              <th className="al-r">Saldo IVA</th>
            </tr>
          </thead>
          <tbody>
            {casas.map((h) => (
              <tr key={h.casa_id}>
                <td>{h.nome}</td>
                <td className="al-r al-num al-dim">
                  {Number(h.peso_base)}%
                </td>
                <td className="al-r">
                  {cc.gera_faturacao ? (
                    <Valor
                      n={Number(h.resultado)}
                      forte={Number(h.resultado) >= 0}
                    />
                  ) : (
                    <Valor n={Number(h.resultado)} />
                  )}
                </td>
                <td className="al-r">
                  <ValorIva n={Number(h.saldo_iva)} />
                </td>
              </tr>
            ))}
            {casas.length === 0 && (
              <tr>
                <td colSpan={4} className="al-hint" style={{ padding: 20 }}>
                  Sem casas neste centro de custo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="al-hint">
        Os pesos servem para repartir custos gerais (ex.: internet)
        automaticamente por casa.
      </p>

      {reservas.length > 0 && (
        <>
          <h2 className="al-h2">Reservas</h2>
          <div className="al-card">
            <table className="al-table">
              <thead>
                <tr>
                  <th>Casa</th>
                  <th>Canal</th>
                  <th>Check-in</th>
                  <th className="al-r">Valor total</th>
                  <th className="al-c">Faturado</th>
                  <th className="al-r">Taxa canal</th>
                  <th className="al-r">Comissão Stripe</th>
                  <th className="al-r">Líquido</th>
                  <th className="al-c">Docs</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {casaNome.get(r.casa_id) ?? "—"}
                      {r.fora_sopro && (
                        <span className="al-tag">por fora</span>
                      )}
                    </td>
                    <td>{r.canal ?? "—"}</td>
                    <td className="al-mono">{dataPt(r.data_checkin)}</td>
                    <td className="al-r">
                      <Valor n={Number(r.valor_total)} />
                    </td>
                    <td className="al-c">
                      {r.faturado ? (
                        <span className="al-chip al-chip-ok">✓ faturado</span>
                      ) : (
                        <span className="al-chip al-chip-no">por faturar</span>
                      )}
                    </td>
                    <td className="al-r">
                      <Valor
                        n={-Number(r.taxa_canal)}
                        dim={Number(r.taxa_canal) === 0}
                      />
                    </td>
                    <td className="al-r">
                      <Valor
                        n={-Number(r.comissao_stripe)}
                        dim={Number(r.comissao_stripe) === 0}
                      />
                    </td>
                    <td className="al-r">
                      <Valor n={Number(r.liquido)} forte />
                    </td>
                    <td className="al-c al-num al-dim">
                      {docsPorReserva.get(r.id) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="al-h2">Livro de lançamentos</h2>
      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Conta</th>
              <th>Descrição</th>
              <th>Casa</th>
              <th className="al-r">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l) => (
              <tr key={l.id}>
                <td className="al-mono">{dataPt(l.data)}</td>
                <td>
                  {l.conta === "iva" ? (
                    <span className="al-iva">IVA</span>
                  ) : (
                    CONTA_LABEL[l.conta] ?? l.conta
                  )}
                </td>
                <td>{l.descricao ?? l.origem ?? "—"}</td>
                <td className="al-dim">
                  {l.casa_id ? (casaNome.get(l.casa_id) ?? "—") : "—"}
                </td>
                <td className="al-r">
                  <Valor n={Number(l.valor)} />
                </td>
              </tr>
            ))}
            {lancamentos.length === 0 && (
              <tr>
                <td colSpan={5} className="al-hint" style={{ padding: 20 }}>
                  Ainda não há lançamentos neste centro de custo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

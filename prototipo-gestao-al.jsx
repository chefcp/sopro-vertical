import React, { useState } from "react";

// Protótipo de desenho — dados de exemplo (não ligado ao Supabase).
// Objetivo: validar disposição e fluxo dos ecrãs principais.

const eur = (n) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);

const DADOS = [
  {
    id: "cc1",
    nome: "Edifício Borges Carneiro",
    geraFaturacao: true,
    receita: 22600,
    custos: 8700,
    taxas: 1240,
    ivaSaldo: 1360,
    suprimentos: 4200,
    casas: [
      { id: "h1", nome: "T1 — casa pequena", peso: 30, receita: 8400, custos: 3100 },
      { id: "h2", nome: "T3 — casa grande", peso: 70, receita: 14200, custos: 5600 },
    ],
    reservas: [
      { ref: "A-1042", canal: "Airbnb", valor: 1240, faturado: true, taxa: 186, stripe: 0, docs: 2 },
      { ref: "V-318", canal: "VRBO", valor: 980, faturado: false, taxa: 78, stripe: 0, docs: 1 },
      { ref: "P-77", canal: "Site próprio", valor: 1500, faturado: true, taxa: 0, stripe: 33, docs: 1 },
    ],
  },
  {
    id: "cc2",
    nome: "Apartamento Alfama",
    geraFaturacao: true,
    receita: 9800,
    custos: 2400,
    taxas: 540,
    ivaSaldo: 410,
    suprimentos: 1500,
    casas: [{ id: "h3", nome: "Estúdio Alfama", peso: 100, receita: 9800, custos: 2400 }],
    reservas: [
      { ref: "A-2210", canal: "Airbnb", valor: 760, faturado: true, taxa: 114, stripe: 0, docs: 1 },
      { ref: "P-58", canal: "Site próprio", valor: 1100, faturado: false, taxa: 0, stripe: 24, docs: 0 },
    ],
  },
  {
    id: "cc3",
    nome: "Armazém / apoio",
    geraFaturacao: false,
    receita: 0,
    custos: 1850,
    taxas: 0,
    ivaSaldo: 426,
    suprimentos: 1850,
    casas: [{ id: "h4", nome: "Armazém de apoio", peso: 100, receita: 0, custos: 1850 }],
    reservas: [],
  },
];

const resultadoDe = (cc) => cc.receita - cc.custos - cc.taxas;

function Valor({ n, forte, dim }) {
  const cls = n < 0 ? "al-neg" : forte ? "al-pos" : "";
  return (
    <span className={`al-num ${cls} ${dim ? "al-dim" : ""}`}>{eur(n)}</span>
  );
}

function Visao({ onAbrir }) {
  const tot = DADOS.reduce(
    (a, cc) => ({
      resultado: a.resultado + resultadoDe(cc),
      iva: a.iva + cc.ivaSaldo,
      sup: a.sup + cc.suprimentos,
      casas: a.casas + cc.casas.length,
    }),
    { resultado: 0, iva: 0, sup: 0, casas: 0 }
  );

  return (
    <div>
      <div className="al-head">
        <h1>Centros de custo</h1>
        <button className="al-btn">Novo centro de custo</button>
      </div>

      <div className="al-kpis">
        <div className="al-kpi">
          <span className="al-kpi-lbl">Resultado acumulado</span>
          <Valor n={tot.resultado} forte />
        </div>
        <div className="al-kpi al-kpi-iva">
          <span className="al-kpi-lbl">Saldo de IVA a recuperar</span>
          <span className="al-num al-iva">{eur(tot.iva)}</span>
        </div>
        <div className="al-kpi">
          <span className="al-kpi-lbl">Suprimentos do proprietário</span>
          <span className="al-num">{eur(tot.sup)}</span>
        </div>
        <div className="al-kpi">
          <span className="al-kpi-lbl">Casas geridas</span>
          <span className="al-num">{tot.casas}</span>
        </div>
      </div>

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Centro de custo</th>
              <th className="al-r">Casas</th>
              <th className="al-r">Receita</th>
              <th className="al-r">Custos</th>
              <th className="al-r">Resultado</th>
              <th className="al-r">Saldo IVA</th>
              <th className="al-r">Suprimentos</th>
            </tr>
          </thead>
          <tbody>
            {DADOS.map((cc) => (
              <tr key={cc.id} tabIndex={0} onClick={() => onAbrir(cc.id)}
                  onKeyDown={(e) => e.key === "Enter" && onAbrir(cc.id)}>
                <td>
                  <span className="al-cc-nome">{cc.nome}</span>
                  {!cc.geraFaturacao && <span className="al-tag">só custos</span>}
                </td>
                <td className="al-r al-num al-dim">{cc.casas.length}</td>
                <td className="al-r">{cc.geraFaturacao ? <Valor n={cc.receita} /> : <span className="al-num al-dim">—</span>}</td>
                <td className="al-r"><Valor n={-cc.custos} /></td>
                <td className="al-r"><Valor n={resultadoDe(cc)} forte={resultadoDe(cc) >= 0} /></td>
                <td className="al-r"><span className="al-num al-iva">{eur(cc.ivaSaldo)}</span></td>
                <td className="al-r"><span className="al-num">{eur(cc.suprimentos)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="al-hint">Carrega numa linha para ver as casas e as reservas do centro de custo.</p>
    </div>
  );
}

function Detalhe({ cc, onVoltar }) {
  return (
    <div>
      <button className="al-back" onClick={onVoltar}>← Centros de custo</button>
      <div className="al-head">
        <h1>{cc.nome}{!cc.geraFaturacao && <span className="al-tag">só custos</span>}</h1>
        <button className="al-btn">Lançar custo</button>
      </div>

      <div className="al-kpis">
        <div className="al-kpi"><span className="al-kpi-lbl">Resultado</span><Valor n={resultadoDe(cc)} forte={resultadoDe(cc) >= 0} /></div>
        <div className="al-kpi al-kpi-iva"><span className="al-kpi-lbl">Saldo de IVA</span><span className="al-num al-iva">{eur(cc.ivaSaldo)}</span></div>
        <div className="al-kpi"><span className="al-kpi-lbl">Suprimentos</span><span className="al-num">{eur(cc.suprimentos)}</span></div>
      </div>

      <h2 className="al-h2">Casas</h2>
      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Casa</th>
              <th className="al-r">Peso de repartição</th>
              <th className="al-r">Receita</th>
              <th className="al-r">Custos alocados</th>
            </tr>
          </thead>
          <tbody>
            {cc.casas.map((h) => (
              <tr key={h.id}>
                <td>{h.nome}</td>
                <td className="al-r al-num al-dim">{h.peso}%</td>
                <td className="al-r">{cc.geraFaturacao ? <Valor n={h.receita} /> : <span className="al-num al-dim">—</span>}</td>
                <td className="al-r"><Valor n={-h.custos} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="al-hint">Os pesos servem para repartir custos gerais (ex.: internet) automaticamente por casa.</p>

      {cc.reservas.length > 0 && (
        <>
          <h2 className="al-h2">Reservas</h2>
          <div className="al-card">
            <table className="al-table">
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Canal</th>
                  <th className="al-r">Valor total</th>
                  <th className="al-c">Faturado</th>
                  <th className="al-r">Taxa canal</th>
                  <th className="al-r">Comissão Stripe</th>
                  <th className="al-r">Líquido</th>
                  <th className="al-c">Docs</th>
                </tr>
              </thead>
              <tbody>
                {cc.reservas.map((r) => (
                  <tr key={r.ref}>
                    <td className="al-mono">#{r.ref}</td>
                    <td>{r.canal}</td>
                    <td className="al-r"><Valor n={r.valor} /></td>
                    <td className="al-c">
                      {r.faturado
                        ? <span className="al-chip al-chip-ok">✓ faturado</span>
                        : <span className="al-chip al-chip-no">por faturar</span>}
                    </td>
                    <td className="al-r"><Valor n={-r.taxa} dim={r.taxa === 0} /></td>
                    <td className="al-r"><Valor n={-r.stripe} dim={r.stripe === 0} /></td>
                    <td className="al-r"><Valor n={r.valor - r.taxa - r.stripe} forte /></td>
                    <td className="al-c al-num al-dim">{r.docs || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [aberto, setAberto] = useState(null);
  const cc = DADOS.find((c) => c.id === aberto);

  return (
    <div className="al-root">
      <style>{`
        .al-root{--paper:#F4F5F2;--surface:#fff;--ink:#18222E;--muted:#6F7680;
          --line:#E5E7E1;--pos:#1C7A52;--neg:#C0492F;--iva:#2563A8;--accent:#117A65;
          font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
          color:var(--ink);background:var(--paper);min-height:100vh;padding:0;}
        .al-num{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
          font-variant-numeric:tabular-nums;font-weight:500;}
        .al-mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:13px;color:var(--muted);}
        .al-pos{color:var(--pos);} .al-neg{color:var(--neg);} .al-iva{color:var(--iva);font-weight:600;}
        .al-dim{color:var(--muted);font-weight:400;}
        .al-topbar{display:flex;align-items:center;justify-content:space-between;
          padding:14px 28px;border-bottom:1px solid var(--line);background:var(--surface);}
        .al-brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:-.01em;}
        .al-dot{width:22px;height:22px;border-radius:6px;background:var(--accent);
          display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;}
        .al-brand small{color:var(--muted);font-weight:400;}
        .al-org{font-size:13px;color:var(--muted);border:1px solid var(--line);
          padding:5px 12px;border-radius:8px;background:var(--paper);}
        .al-tabs{display:flex;gap:4px;padding:0 22px;border-bottom:1px solid var(--line);background:var(--surface);}
        .al-tabs span{padding:12px 14px;font-size:14px;color:var(--muted);border-bottom:2px solid transparent;}
        .al-tabs span.on{color:var(--ink);border-bottom-color:var(--accent);font-weight:600;}
        .al-wrap{max-width:1080px;margin:0 auto;padding:28px;}
        .al-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
        .al-head h1{font-size:24px;font-weight:650;letter-spacing:-.02em;margin:0;display:flex;align-items:center;}
        .al-h2{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
          color:var(--muted);margin:28px 0 10px;}
        .al-btn{background:var(--ink);color:#fff;border:none;border-radius:8px;
          padding:9px 15px;font-size:14px;font-weight:550;cursor:pointer;}
        .al-btn:hover{opacity:.9;}
        .al-back{background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;padding:0 0 14px;}
        .al-back:hover{color:var(--ink);}
        .al-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
        .al-kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;
          padding:16px 18px;display:flex;flex-direction:column;gap:8px;}
        .al-kpi-iva{border-left:3px solid var(--iva);}
        .al-kpi-lbl{font-size:12.5px;color:var(--muted);}
        .al-kpi .al-num{font-size:22px;}
        .al-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
        .al-table{width:100%;border-collapse:collapse;font-size:14px;}
        .al-table th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;
          color:var(--muted);font-weight:600;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--paper);}
        .al-table td{padding:13px 16px;border-bottom:1px solid var(--line);}
        .al-table tbody tr:last-child td{border-bottom:none;}
        .al-table tbody tr[tabindex]{cursor:pointer;}
        .al-table tbody tr[tabindex]:hover{background:#FAFBF9;}
        .al-table tbody tr[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;}
        .al-r{text-align:right;} .al-c{text-align:center;}
        .al-cc-nome{font-weight:550;}
        .al-tag{display:inline-block;margin-left:9px;font-size:11px;font-weight:600;color:var(--muted);
          background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:2px 9px;
          text-transform:none;letter-spacing:0;}
        .al-chip{font-size:12px;font-weight:600;border-radius:20px;padding:3px 10px;white-space:nowrap;}
        .al-chip-ok{color:var(--pos);background:rgba(28,122,82,.10);}
        .al-chip-no{color:var(--neg);background:rgba(192,73,47,.10);}
        .al-hint{font-size:13px;color:var(--muted);margin:12px 2px 0;}
        @media (max-width:760px){
          .al-kpis{grid-template-columns:repeat(2,1fr);}
          .al-wrap{padding:18px;}
          .al-table{font-size:13px;} .al-table th,.al-table td{padding:10px;}
        }
        @media (prefers-reduced-motion:reduce){.al-root *{transition:none!important;}}
      `}</style>

      <div className="al-topbar">
        <div className="al-brand">
          <span className="al-dot">AL</span>
          Comida Pronta <small>· Alojamento Local</small>
        </div>
        <span className="al-org">chefcp's Org ▾</span>
      </div>
      <div className="al-tabs">
        <span className="on">Centros de custo</span>
        <span>Casas</span>
        <span>Reservas</span>
        <span>Custos</span>
        <span>Documentos</span>
      </div>

      <div className="al-wrap">
        {cc ? <Detalhe cc={cc} onVoltar={() => setAberto(null)} />
            : <Visao onAbrir={setAberto} />}
      </div>
    </div>
  );
}

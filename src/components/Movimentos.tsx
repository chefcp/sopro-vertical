"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Valor } from "@/components/Valor";
import { eur, dataPt } from "@/lib/format";
import {
  editarLinhaMovimentoAction,
  adicionarLinhaMovimentoAction,
  removerLinhaMovimentoAction,
  destravarMovimentoAction,
  criarMovimentoManualAction,
  type LinhaManual,
} from "@/lib/actions/movimentos";

type CC = { id: string; nome: string };
type Casa = { id: string; nome: string; centro_custo_id: string };

export type MovLeg = {
  id: string;
  conta: string;
  cc: string;
  cc_id: string;
  casa: string;
  casa_id: string | null;
  valor: number;
  descricao: string;
};

export type Movimento = {
  key: string;
  ref_id: string;
  data: string;
  titulo: string;
  origem: string;
  origem_id: string | null;
  locked: boolean;
  impacto_resultado: number;
  impacto_tesouraria: number;
  legs: MovLeg[];
};

const CONTA_LABEL: Record<string, string> = {
  resultado: "Resultado",
  iva: "IVA",
  suprimentos: "Suprimentos",
  tesouraria: "Tesouraria",
  cc_corrente: "Conta-corrente",
};
const CONTAS = ["resultado", "iva", "suprimentos", "tesouraria", "cc_corrente"];
const ORIGEM_LABEL: Record<string, string> = {
  custo: "Custo",
  reserva: "Reserva",
  manual: "Manual",
  pagamento: "Pagamento",
  suprimento: "Suprimentos",
};

const inp: React.CSSProperties = {
  padding: "5px 7px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12.5,
  background: "var(--surface)",
  color: "var(--ink)",
  width: "100%",
  minWidth: 0,
};

export function Movimentos({
  movimentos,
  centros,
  casas,
}: {
  movimentos: Movimento[];
  centros: CC[];
  casas: Casa[];
}) {
  const [fTexto, setFTexto] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [soEditados, setSoEditados] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [novoAberto, setNovoAberto] = useState(false);

  const origens = useMemo(
    () => [...new Set(movimentos.map((m) => m.origem))].sort(),
    [movimentos],
  );

  const lista = useMemo(() => {
    const t = fTexto.trim().toLowerCase();
    return movimentos.filter((m) => {
      if (fOrigem && m.origem !== fOrigem) return false;
      if (soEditados && !m.locked) return false;
      if (t && !m.titulo.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [movimentos, fTexto, fOrigem, soEditados]);

  const toggle = (k: string) =>
    setAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <input
          placeholder="Procurar (fornecedor, reserva, descrição)…"
          value={fTexto}
          onChange={(e) => setFTexto(e.target.value)}
          style={{ ...inp, width: "auto", minWidth: 260 }}
        />
        <select value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="">Origem (todas)</option>
          {origens.map((o) => (
            <option key={o} value={o}>{ORIGEM_LABEL[o] ?? o}</option>
          ))}
        </select>
        <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
          <input type="checkbox" checked={soEditados} onChange={(e) => setSoEditados(e.target.checked)} />
          só editados à mão 🔒
        </label>
        <button
          type="button"
          className="al-btn"
          style={{ marginLeft: "auto" }}
          onClick={() => setNovoAberto((v) => !v)}
        >
          {novoAberto ? "Fechar" : "+ Novo movimento manual"}
        </button>
      </div>

      {novoAberto && (
        <NovoMovimento
          centros={centros}
          casas={casas}
          onDone={() => setNovoAberto(false)}
        />
      )}

      <div className="al-card" style={{ overflowX: "auto" }}>
        <table className="al-table" style={{ width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th style={{ minWidth: 100 }}>Data</th>
              <th>Movimento</th>
              <th style={{ minWidth: 90 }}>Origem</th>
              <th className="al-r" style={{ minWidth: 130 }}>Impacto</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => {
              const aberto = abertos.has(m.key);
              const usaResultado = m.impacto_resultado !== 0 || m.impacto_tesouraria === 0;
              return (
                <MovimentoRow
                  key={m.key}
                  m={m}
                  aberto={aberto}
                  usaResultado={usaResultado}
                  onToggle={() => toggle(m.key)}
                  centros={centros}
                  casas={casas}
                />
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="al-hint" style={{ padding: 24 }}>
                  Nenhum movimento com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="al-hint">
        Cada linha é um <strong>acontecimento</strong>. Carrega na setinha para ver e
        editar os lançamentos por conta/CC. Editar à mão <strong>trava</strong> o
        movimento (🔒) — deixa de ser recalculado quando gravas o custo/reserva de
        origem; usa <strong>&quot;Voltar ao automático&quot;</strong> para o soltar.
      </p>
    </div>
  );
}

function MovimentoRow({
  m,
  aberto,
  usaResultado,
  onToggle,
  centros,
  casas,
}: {
  m: Movimento;
  aberto: boolean;
  usaResultado: boolean;
  onToggle: () => void;
  centros: CC[];
  casas: Casa[];
}) {
  const router = useRouter();
  const [aProcessar, start] = useTransition();

  const destravar = () =>
    start(async () => {
      if (!window.confirm("Voltar ao automático? As edições manuais deste movimento serão substituídas pelo cálculo do sistema.")) return;
      const r = await destravarMovimentoAction(m.ref_id);
      if (r.error) window.alert(r.error);
      router.refresh();
    });

  return (
    <>
      <tr style={{ cursor: "pointer" }} onClick={onToggle}>
        <td style={{ textAlign: "center", color: "var(--muted)" }}>{aberto ? "▾" : "▸"}</td>
        <td className="al-mono">{dataPt(m.data)}</td>
        <td>
          <span className="al-cc-nome">{m.titulo}</span>
          {m.locked && (
            <span className="al-tag" title="Editado à mão — não é recalculado">🔒 editado</span>
          )}
        </td>
        <td className="al-dim">{ORIGEM_LABEL[m.origem] ?? m.origem}</td>
        <td className="al-r">
          {usaResultado ? (
            <Valor n={m.impacto_resultado} forte={m.impacto_resultado >= 0} />
          ) : (
            <Valor n={m.impacto_tesouraria} />
          )}
          <span className="al-hint" style={{ display: "block", margin: 0, fontSize: 11 }}>
            {usaResultado ? "resultado" : "tesouraria"}
          </span>
        </td>
      </tr>
      {aberto && (
        <tr>
          <td></td>
          <td colSpan={4} style={{ paddingTop: 0 }}>
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 12,
                background: "var(--paper)",
                marginBottom: 8,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ fontSize: 11, color: "var(--muted)", textAlign: "left" }}>
                    <th style={{ padding: "2px 6px" }}>Conta</th>
                    <th style={{ padding: "2px 6px" }}>Centro de custo</th>
                    <th style={{ padding: "2px 6px" }}>Casa</th>
                    <th style={{ padding: "2px 6px", textAlign: "right" }}>Valor</th>
                    <th style={{ padding: "2px 6px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {m.legs.map((leg) => (
                    <LegRow key={leg.id} leg={leg} centros={centros} casas={casas} />
                  ))}
                </tbody>
              </table>

              <AddLeg refId={m.ref_id} centros={centros} casas={casas} />

              <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                {m.locked ? (
                  <button type="button" className="al-btn" onClick={destravar} disabled={aProcessar}>
                    Voltar ao automático
                  </button>
                ) : (
                  m.origem === "custo" || m.origem === "reserva" ? (
                    <span className="al-hint" style={{ margin: 0 }}>
                      Editar aqui <strong>trava</strong> o movimento (deixa de ser recalculado).
                    </span>
                  ) : null
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LegRow({ leg, centros, casas }: { leg: MovLeg; centros: CC[]; casas: Casa[] }) {
  const router = useRouter();
  const [cc, setCc] = useState(leg.cc_id);
  const [casaId, setCasaId] = useState(leg.casa_id ?? "");
  const [valor, setValor] = useState(String(leg.valor));
  const [desc, setDesc] = useState(leg.descricao);
  const [aProcessar, start] = useTransition();

  const alterado =
    cc !== leg.cc_id ||
    (casaId || "") !== (leg.casa_id ?? "") ||
    Number(valor) !== leg.valor ||
    desc !== leg.descricao;

  const guardar = () =>
    start(async () => {
      const r = await editarLinhaMovimentoAction({
        id: leg.id,
        centro_custo_id: cc,
        casa_id: casaId || null,
        valor: Number(valor),
        descricao: desc,
      });
      if (r.error) window.alert(r.error);
      router.refresh();
    });
  const remover = () =>
    start(async () => {
      if (!window.confirm("Remover esta linha do movimento?")) return;
      const r = await removerLinhaMovimentoAction(leg.id);
      if (r.error) window.alert(r.error);
      router.refresh();
    });

  const casasDoCc = casas.filter((c) => c.centro_custo_id === cc);

  return (
    <tr>
      <td style={{ padding: "3px 6px" }}>
        {leg.conta === "iva" ? <span className="al-iva">IVA</span> : CONTA_LABEL[leg.conta] ?? leg.conta}
      </td>
      <td style={{ padding: "3px 6px" }}>
        <select value={cc} onChange={(e) => { setCc(e.target.value); setCasaId(""); }} style={inp}>
          {centros.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </td>
      <td style={{ padding: "3px 6px" }}>
        <select value={casaId} onChange={(e) => setCasaId(e.target.value)} style={inp} disabled={casasDoCc.length === 0}>
          <option value="">—</option>
          {casasDoCc.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </td>
      <td style={{ padding: "3px 6px", textAlign: "right" }}>
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          style={{ ...inp, textAlign: "right", maxWidth: 110 }}
        />
      </td>
      <td style={{ padding: "3px 6px", whiteSpace: "nowrap" }}>
        {alterado && (
          <button type="button" className="al-btn" style={{ padding: "4px 8px", fontSize: 12 }} onClick={guardar} disabled={aProcessar}>
            Guardar
          </button>
        )}
        <button type="button" className="al-back" style={{ padding: "0 6px", color: "var(--neg)" }} onClick={remover} disabled={aProcessar} title="Remover linha">
          ✕
        </button>
      </td>
    </tr>
  );
}

function AddLeg({ refId, centros, casas }: { refId: string; centros: CC[]; casas: Casa[] }) {
  const router = useRouter();
  const [conta, setConta] = useState("tesouraria");
  const [cc, setCc] = useState("");
  const [casaId, setCasaId] = useState("");
  const [valor, setValor] = useState("");
  const [desc, setDesc] = useState("");
  const [aProcessar, start] = useTransition();

  const adicionar = () =>
    start(async () => {
      const r = await adicionarLinhaMovimentoAction({
        ref_id: refId,
        conta,
        centro_custo_id: cc,
        casa_id: casaId || null,
        valor: Number(valor),
        descricao: desc,
      });
      if (r.error) { window.alert(r.error); return; }
      setValor(""); setDesc("");
      router.refresh();
    });

  const casasDoCc = casas.filter((c) => c.centro_custo_id === cc);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <span className="al-hint" style={{ margin: 0 }}>+ Linha:</span>
      <select value={conta} onChange={(e) => setConta(e.target.value)} style={{ ...inp, width: "auto" }}>
        {CONTAS.map((c) => (<option key={c} value={c}>{CONTA_LABEL[c]}</option>))}
      </select>
      <select value={cc} onChange={(e) => { setCc(e.target.value); setCasaId(""); }} style={{ ...inp, width: "auto" }}>
        <option value="">Centro de custo…</option>
        {centros.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
      </select>
      <select value={casaId} onChange={(e) => setCasaId(e.target.value)} style={{ ...inp, width: "auto" }} disabled={!cc || casasDoCc.length === 0}>
        <option value="">— casa —</option>
        {casasDoCc.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
      </select>
      <input inputMode="decimal" placeholder="valor" value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...inp, width: 90, textAlign: "right" }} />
      <input placeholder="descrição (opc.)" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ ...inp, width: 160 }} />
      <button type="button" className="al-btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={adicionar} disabled={aProcessar || !cc || !valor}>
        Adicionar
      </button>
    </div>
  );
}

function NovoMovimento({
  centros,
  casas,
  onDone,
}: {
  centros: CC[];
  casas: Casa[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [linhas, setLinhas] = useState<LinhaManual[]>([
    { conta: "tesouraria", centro_custo_id: "", casa_id: null, valor: 0, descricao: "" },
  ]);
  const [erro, setErro] = useState<string | null>(null);
  const [aProcessar, start] = useTransition();

  const set = (i: number, p: Partial<LinhaManual>) =>
    setLinhas((prev) => prev.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const addLinha = () =>
    setLinhas((prev) => [...prev, { conta: "tesouraria", centro_custo_id: "", casa_id: null, valor: 0, descricao: "" }]);
  const rmLinha = (i: number) =>
    setLinhas((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => j !== i)));

  const gravar = () =>
    start(async () => {
      setErro(null);
      const r = await criarMovimentoManualAction({ titulo, data, linhas });
      if (r.error) { setErro(r.error); return; }
      onDone();
      router.refresh();
    });

  return (
    <div className="al-card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <input placeholder="Nome do movimento (ex.: Acerto banco)" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ ...inp, width: "auto", minWidth: 260 }} />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inp, width: "auto" }} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ fontSize: 11, color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "2px 6px" }}>Conta</th>
            <th style={{ padding: "2px 6px" }}>Centro de custo</th>
            <th style={{ padding: "2px 6px" }}>Casa</th>
            <th style={{ padding: "2px 6px", textAlign: "right" }}>Valor (+/−)</th>
            <th style={{ padding: "2px 6px" }}>Descrição</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const casasDoCc = casas.filter((c) => c.centro_custo_id === l.centro_custo_id);
            return (
              <tr key={i}>
                <td style={{ padding: "3px 6px" }}>
                  <select value={l.conta} onChange={(e) => set(i, { conta: e.target.value })} style={inp}>
                    {CONTAS.map((c) => (<option key={c} value={c}>{CONTA_LABEL[c]}</option>))}
                  </select>
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <select value={l.centro_custo_id} onChange={(e) => set(i, { centro_custo_id: e.target.value, casa_id: null })} style={inp}>
                    <option value="">—</option>
                    {centros.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                  </select>
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <select value={l.casa_id ?? ""} onChange={(e) => set(i, { casa_id: e.target.value || null })} style={inp} disabled={casasDoCc.length === 0}>
                    <option value="">—</option>
                    {casasDoCc.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                  </select>
                </td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  <input inputMode="decimal" value={l.valor === 0 ? "" : String(l.valor)} onChange={(e) => set(i, { valor: Number(e.target.value) || 0 })} style={{ ...inp, textAlign: "right", maxWidth: 110 }} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input value={l.descricao} onChange={(e) => set(i, { descricao: e.target.value })} style={inp} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <button type="button" className="al-back" style={{ padding: 0 }} onClick={() => rmLinha(i)}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="al-back" style={{ padding: 0 }} onClick={addLinha}>+ Adicionar linha</button>
        <button type="button" className="al-btn" style={{ marginLeft: "auto" }} onClick={gravar} disabled={aProcessar}>
          {aProcessar ? "A gravar…" : "Gravar movimento"}
        </button>
      </div>
      {erro && <p className="al-num al-neg" style={{ fontSize: 12.5, margin: "8px 0 0" }}>{erro}</p>}
      <p className="al-hint" style={{ margin: "8px 0 0" }}>
        Um movimento manual entra no livro como já editado à mão. Usa valores com
        sinal (ex.: Tesouraria +100 num CC e −100 noutro).
      </p>
    </div>
  );
}

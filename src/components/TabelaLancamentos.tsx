"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Valor } from "@/components/Valor";
import { eur, dataPt } from "@/lib/format";

export type LancLinha = {
  id: string;
  data: string;
  cc: string;
  casa: string;
  conta: string;
  valor: number;
  descricao: string;
  origem: string;
  origem_id: string | null;
};

const CONTA_LABEL: Record<string, string> = {
  resultado: "Resultado",
  iva: "IVA",
  suprimentos: "Suprimentos",
  tesouraria: "Tesouraria",
  cc_corrente: "Conta-corrente",
};
const ORIGEM_LABEL: Record<string, string> = {
  custo: "Custo",
  reserva: "Reserva",
  manual: "Manual",
  pagamento: "Pagamento",
  suprimento: "Suprimentos",
};

type SortKey = "data" | "cc" | "conta" | "origem" | "valor";

function val(l: LancLinha, k: SortKey): string | number {
  switch (k) {
    case "data":
      return l.data ?? "";
    case "cc":
      return l.cc.toLowerCase();
    case "conta":
      return l.conta;
    case "origem":
      return l.origem;
    case "valor":
      return Number(l.valor);
  }
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "var(--surface)",
  color: "var(--ink)",
};

export function TabelaLancamentos({ lancamentos }: { lancamentos: LancLinha[] }) {
  const router = useRouter();
  const [fCc, setFCc] = useState("");
  const [fConta, setFConta] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [fCasa, setFCasa] = useState("");
  const [fTexto, setFTexto] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ccs = useMemo(
    () => [...new Set(lancamentos.map((l) => l.cc).filter(Boolean))].sort(),
    [lancamentos],
  );
  const casas = useMemo(
    () => [...new Set(lancamentos.map((l) => l.casa).filter(Boolean))].sort(),
    [lancamentos],
  );
  const contas = useMemo(
    () => [...new Set(lancamentos.map((l) => l.conta))].sort(),
    [lancamentos],
  );
  const origens = useMemo(
    () => [...new Set(lancamentos.map((l) => l.origem).filter(Boolean))].sort(),
    [lancamentos],
  );

  const filtrados = useMemo(() => {
    const arr = lancamentos.filter((l) => {
      if (fCc && l.cc !== fCc) return false;
      if (fConta && l.conta !== fConta) return false;
      if (fOrigem && l.origem !== fOrigem) return false;
      if (fCasa && l.casa !== fCasa) return false;
      if (fDe && (l.data ?? "") < fDe) return false;
      if (fAte && (l.data ?? "") > fAte) return false;
      if (fTexto) {
        const t = fTexto.toLowerCase();
        if (
          !(l.descricao ?? "").toLowerCase().includes(t) &&
          !l.cc.toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    });
    arr.sort((a, b) => {
      const va = val(a, sortKey);
      const vb = val(b, sortKey);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [lancamentos, fCc, fConta, fOrigem, fCasa, fTexto, fDe, fAte, sortKey, sortDir]);

  const ordenarPor = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "data" || k === "valor" ? "desc" : "asc");
    }
  };
  const seta = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const Th = ({ k, label, r }: { k: SortKey; label: string; r?: boolean }) => (
    <th
      className={r ? "al-r" : undefined}
      style={{ cursor: "pointer", userSelect: "none" }}
      onClick={() => ordenarPor(k)}
    >
      {label}
      {seta(k)}
    </th>
  );

  const total = filtrados.reduce((s, l) => s + Number(l.valor), 0);
  const irParaOrigem = (l: LancLinha) => {
    if (l.origem === "custo" && l.origem_id) router.push(`/custos/${l.origem_id}`);
    else if (l.origem === "reserva" && l.origem_id)
      router.push(`/reservas/${l.origem_id}`);
  };
  const temLink = (l: LancLinha) =>
    (l.origem === "custo" || l.origem === "reserva") && !!l.origem_id;

  const limpar = () => {
    setFCc(""); setFConta(""); setFOrigem(""); setFCasa("");
    setFTexto(""); setFDe(""); setFAte("");
  };
  const algumFiltro = fCc || fConta || fOrigem || fCasa || fTexto || fDe || fAte;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <select value={fCc} onChange={(e) => setFCc(e.target.value)} style={inputStyle}>
          <option value="">Centro de custo (todos)</option>
          {ccs.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select value={fConta} onChange={(e) => setFConta(e.target.value)} style={inputStyle}>
          <option value="">Conta (todas)</option>
          {contas.map((c) => (<option key={c} value={c}>{CONTA_LABEL[c] ?? c}</option>))}
        </select>
        <select value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} style={inputStyle}>
          <option value="">Origem (todas)</option>
          {origens.map((o) => (<option key={o} value={o}>{ORIGEM_LABEL[o] ?? o}</option>))}
        </select>
        <select value={fCasa} onChange={(e) => setFCasa(e.target.value)} style={inputStyle}>
          <option value="">Casa (todas)</option>
          {casas.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <input
          placeholder="Descrição…"
          value={fTexto}
          onChange={(e) => setFTexto(e.target.value)}
          style={inputStyle}
        />
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          De <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          a <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={inputStyle} />
        </label>
        {algumFiltro && (
          <button type="button" className="al-back" style={{ padding: 0 }} onClick={limpar}>
            limpar filtros
          </button>
        )}
      </div>

      <div className="al-card" style={{ overflowX: "auto" }}>
        <table className="al-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <Th k="data" label="Data" />
              <Th k="cc" label="Centro de custo" />
              <th>Casa</th>
              <Th k="conta" label="Conta" />
              <th>Descrição</th>
              <Th k="origem" label="Origem" />
              <Th k="valor" label="Valor" r />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l) => {
              const link = temLink(l);
              return (
                <tr
                  key={l.id}
                  tabIndex={link ? 0 : undefined}
                  style={link ? { cursor: "pointer" } : undefined}
                  onClick={link ? () => irParaOrigem(l) : undefined}
                  onKeyDown={
                    link ? (e) => e.key === "Enter" && irParaOrigem(l) : undefined
                  }
                >
                  <td className="al-mono">{dataPt(l.data)}</td>
                  <td>{l.cc}</td>
                  <td className="al-dim">{l.casa || "—"}</td>
                  <td>
                    {l.conta === "iva" ? (
                      <span className="al-iva">IVA</span>
                    ) : (
                      CONTA_LABEL[l.conta] ?? l.conta
                    )}
                  </td>
                  <td className="al-dim">{l.descricao || "—"}</td>
                  <td>
                    {ORIGEM_LABEL[l.origem] ?? l.origem ?? "—"}
                    {link && <span className="al-dim"> ↗</span>}
                  </td>
                  <td className="al-r">
                    <Valor n={Number(l.valor)} />
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="al-hint" style={{ padding: 24 }}>
                  Nenhum lançamento com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={6} className="al-r" style={{ fontWeight: 600 }}>
                  Soma ({filtrados.length})
                </td>
                <td className="al-r">
                  <span className="al-num">{eur(total)}</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="al-hint">
        Filtra por conta/origem/CC para ver como cada coisa gerou os lançamentos.
        Linhas de custos e reservas (↗) abrem a respetiva origem.
      </p>
    </div>
  );
}

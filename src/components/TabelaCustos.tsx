"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Valor, ValorIva } from "@/components/Valor";
import { eur, dataPt } from "@/lib/format";

export type CustoLinha = {
  id: string;
  fornecedor: string;
  descricao: string | null;
  data: string;
  valor_base: number;
  iva: number;
  total: number;
  pago_por: string;
};

type SortKey = "fornecedor" | "data" | "valor_base" | "iva" | "total" | "pago_por";

function val(c: CustoLinha, k: SortKey): string | number {
  switch (k) {
    case "fornecedor":
      return c.fornecedor.toLowerCase();
    case "pago_por":
      return c.pago_por.toLowerCase();
    case "data":
      return c.data ?? "";
    case "valor_base":
      return Number(c.valor_base);
    case "iva":
      return Number(c.iva);
    case "total":
      return Number(c.total);
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

export function TabelaCustos({ custos }: { custos: CustoLinha[] }) {
  const router = useRouter();
  const [fForn, setFForn] = useState("");
  const [fPago, setFPago] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const pagos = useMemo(
    () => [...new Set(custos.map((c) => c.pago_por))].sort(),
    [custos],
  );

  const filtrados = useMemo(() => {
    const arr = custos.filter((c) => {
      if (fForn && !c.fornecedor.toLowerCase().includes(fForn.toLowerCase()))
        return false;
      if (fPago && c.pago_por !== fPago) return false;
      if (fDe && (c.data ?? "") < fDe) return false;
      if (fAte && (c.data ?? "") > fAte) return false;
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
  }, [custos, fForn, fPago, fDe, fAte, sortKey, sortDir]);

  const ordenarPor = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "data" ? "desc" : "asc");
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

  const totBase = filtrados.reduce((s, c) => s + Number(c.valor_base), 0);
  const totIva = filtrados.reduce((s, c) => s + Number(c.iva), 0);
  const totTotal = filtrados.reduce((s, c) => s + Number(c.total), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          placeholder="Fornecedor…"
          value={fForn}
          onChange={(e) => setFForn(e.target.value)}
          style={inputStyle}
        />
        <select value={fPago} onChange={(e) => setFPago(e.target.value)} style={inputStyle}>
          <option value="">Pago por (todos)</option>
          {pagos.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          Data de{" "}
          <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          a <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={inputStyle} />
        </label>
        {(fForn || fPago || fDe || fAte) && (
          <button
            type="button"
            className="al-back"
            style={{ padding: 0 }}
            onClick={() => { setFForn(""); setFPago(""); setFDe(""); setFAte(""); }}
          >
            limpar filtros
          </button>
        )}
      </div>

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <Th k="fornecedor" label="Fornecedor" />
              <Th k="data" label="Data" />
              <Th k="valor_base" label="Valor base" r />
              <Th k="iva" label="IVA" r />
              <Th k="total" label="Total" r />
              <Th k="pago_por" label="Pago por" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr
                key={c.id}
                tabIndex={0}
                onClick={() => router.push(`/custos/${c.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/custos/${c.id}`)}
              >
                <td>
                  <span className="al-cc-nome">{c.fornecedor}</span>
                  {c.descricao && (
                    <span className="al-dim" style={{ marginLeft: 8 }}>{c.descricao}</span>
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
                  <span className="al-num">{eur(c.total)}</span>
                </td>
                <td>{c.pago_por}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="al-hint" style={{ padding: 24 }}>
                  Nenhum custo com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} className="al-r" style={{ fontWeight: 600 }}>
                  Totais ({filtrados.length})
                </td>
                <td className="al-r"><span className="al-num">{eur(-totBase)}</span></td>
                <td className="al-r"><span className="al-num al-iva">{eur(totIva)}</span></td>
                <td className="al-r"><span className="al-num">{eur(totTotal)}</span></td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="al-hint">
        Carrega num custo para editar/apagar; num cabeçalho para ordenar.
      </p>
    </div>
  );
}

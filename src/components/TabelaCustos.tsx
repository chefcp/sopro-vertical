"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Valor, ValorIva } from "@/components/Valor";
import { eur, dataPt } from "@/lib/format";
import {
  mudarPagoPorCustosAction,
  mudarCentroCustoCustosAction,
  apagarCustosAction,
} from "@/lib/actions/custos";

export type CustoLinha = {
  id: string;
  fornecedor: string;
  descricao: string | null;
  data: string;
  valor_base: number;
  iva: number;
  total: number;
  pago_por: string;
  centros: string;
  centro_ids: string[];
  casas: string;
  casa_ids: string[];
  tem_doc: boolean;
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

export function TabelaCustos({
  custos,
  centros,
  casas,
}: {
  custos: CustoLinha[];
  centros: { id: string; nome: string }[];
  casas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [fForn, setFForn] = useState("");
  const [fPago, setFPago] = useState("");
  const [fCc, setFCc] = useState("");
  const [fCasa, setFCasa] = useState("");
  const [fSemDoc, setFSemDoc] = useState(false);
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aProcessar, startProcessar] = useTransition();
  const [bPagoTipo, setBPagoTipo] = useState<"sopro" | "cc">("sopro");
  const [bPagoCc, setBPagoCc] = useState("");
  const [bCc, setBCc] = useState("");

  const pagos = useMemo(
    () => [...new Set(custos.map((c) => c.pago_por))].sort(),
    [custos],
  );

  const filtrados = useMemo(() => {
    const arr = custos.filter((c) => {
      if (fForn && !c.fornecedor.toLowerCase().includes(fForn.toLowerCase()))
        return false;
      if (fPago && c.pago_por !== fPago) return false;
      if (fCc && !c.centro_ids.includes(fCc)) return false;
      if (fCasa && !c.casa_ids.includes(fCasa)) return false;
      if (fSemDoc && c.tem_doc) return false;
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
  }, [custos, fForn, fPago, fCc, fCasa, fSemDoc, fDe, fAte, sortKey, sortDir]);

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

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todosSel = filtrados.length > 0 && filtrados.every((c) => sel.has(c.id));
  const toggleTodos = () =>
    setSel(todosSel ? new Set() : new Set(filtrados.map((c) => c.id)));
  const limparSel = () => setSel(new Set());

  const aplicarPago = () =>
    startProcessar(async () => {
      await mudarPagoPorCustosAction(
        [...sel],
        bPagoTipo,
        bPagoTipo === "cc" ? bPagoCc : null,
      );
      limparSel();
      router.refresh();
    });
  const aplicarCc = () => {
    if (!bCc) return;
    startProcessar(async () => {
      await mudarCentroCustoCustosAction([...sel], bCc);
      limparSel();
      router.refresh();
    });
  };
  const apagarSel = () => {
    if (
      !window.confirm(
        `Apagar ${sel.size} custo(s)? Os lançamentos saem do livro. Não pode ser anulado.`,
      )
    )
      return;
    startProcessar(async () => {
      await apagarCustosAction([...sel]);
      limparSel();
      router.refresh();
    });
  };

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const aoa = [
      [
        "Fornecedor",
        "Descrição",
        "Data",
        "Base",
        "IVA",
        "Total",
        "Pago por",
        "Centro(s) de custo",
        "Casa(s)",
        "Tem fatura",
      ],
      ...filtrados.map((c) => [
        c.fornecedor,
        c.descricao ?? "",
        c.data,
        c.valor_base,
        c.iva,
        c.total,
        c.pago_por,
        c.centros,
        c.casas,
        c.tem_doc ? "Sim" : "Não",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custos");
    XLSX.writeFile(wb, "custos-sopro.xlsx");
  }

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
        <select value={fCc} onChange={(e) => setFCc(e.target.value)} style={inputStyle}>
          <option value="">Centro de custo (todos)</option>
          {centros.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select value={fCasa} onChange={(e) => setFCasa(e.target.value)} style={inputStyle}>
          <option value="">Casa (todas)</option>
          {casas.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <label
          style={{
            fontSize: 12,
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <input
            type="checkbox"
            checked={fSemDoc}
            onChange={(e) => setFSemDoc(e.target.checked)}
          />
          só sem fatura
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          Data de{" "}
          <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          a <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={inputStyle} />
        </label>
        {(fForn || fPago || fCc || fCasa || fSemDoc || fDe || fAte) && (
          <button
            type="button"
            className="al-back"
            style={{ padding: 0 }}
            onClick={() => {
              setFForn(""); setFPago(""); setFCc(""); setFCasa("");
              setFSemDoc(false); setFDe(""); setFAte("");
            }}
          >
            limpar filtros
          </button>
        )}
        <button
          type="button"
          className="al-btn"
          style={{ marginLeft: "auto" }}
          onClick={exportarExcel}
          disabled={filtrados.length === 0}
        >
          Exportar (.xlsx)
        </button>
      </div>

      {sel.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 12,
            padding: "10px 12px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
            {sel.size} selecionado(s)
          </span>

          <label style={{ fontSize: 12, color: "var(--muted)" }}>
            Mudar pago por
            <br />
            <span style={{ display: "flex", gap: 4 }}>
              <select
                value={bPagoTipo}
                onChange={(e) => setBPagoTipo(e.target.value as "sopro" | "cc")}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="sopro">Sopro</option>
                <option value="cc">Centro de custo</option>
              </select>
              {bPagoTipo === "cc" && (
                <select
                  value={bPagoCc}
                  onChange={(e) => setBPagoCc(e.target.value)}
                  style={{ ...inputStyle, width: "auto" }}
                >
                  <option value="">—</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="al-btn"
                onClick={aplicarPago}
                disabled={aProcessar || (bPagoTipo === "cc" && !bPagoCc)}
              >
                Aplicar
              </button>
            </span>
          </label>

          <label style={{ fontSize: 12, color: "var(--muted)" }}>
            Mudar centro de custo
            <br />
            <span style={{ display: "flex", gap: 4 }}>
              <select
                value={bCc}
                onChange={(e) => setBCc(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="">—</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <button
                type="button"
                className="al-btn"
                onClick={aplicarCc}
                disabled={aProcessar || !bCc}
              >
                Aplicar
              </button>
            </span>
          </label>

          <button
            type="button"
            className="al-btn"
            style={{ borderColor: "var(--neg)", color: "var(--neg)" }}
            onClick={apagarSel}
            disabled={aProcessar}
          >
            Apagar selecionados
          </button>
          <button
            type="button"
            className="al-back"
            style={{ padding: 0 }}
            onClick={limparSel}
          >
            limpar seleção
          </button>
        </div>
      )}

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={todosSel}
                  onChange={toggleTodos}
                  title="Selecionar todos (filtrados)"
                />
              </th>
              <Th k="fornecedor" label="Fornecedor" />
              <Th k="data" label="Data" />
              <Th k="valor_base" label="Valor base" r />
              <Th k="iva" label="IVA" r />
              <Th k="total" label="Total" r />
              <th>Centro de custo</th>
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
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={sel.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                </td>
                <td>
                  <span className="al-cc-nome">{c.fornecedor}</span>
                  {c.descricao && (
                    <span className="al-dim" style={{ marginLeft: 8 }}>{c.descricao}</span>
                  )}
                  {!c.tem_doc && <span className="al-tag">sem fatura</span>}
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
                <td className="al-dim">
                  {c.centros || "—"}
                  {c.casas ? ` · ${c.casas}` : ""}
                </td>
                <td>{c.pago_por}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="al-hint" style={{ padding: 24 }}>
                  Nenhum custo com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="al-r" style={{ fontWeight: 600 }}>
                  Totais ({filtrados.length})
                </td>
                <td className="al-r"><span className="al-num">{eur(-totBase)}</span></td>
                <td className="al-r"><span className="al-num al-iva">{eur(totIva)}</span></td>
                <td className="al-r"><span className="al-num">{eur(totTotal)}</span></td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="al-hint">
        Carrega num custo para editar/apagar; num cabeçalho para ordenar. Marca
        as caixas para, em vários de uma vez, <strong>mudar quem pagou</strong>,{" "}
        <strong>mudar o centro de custo</strong> ou <strong>apagar</strong>.
      </p>
    </div>
  );
}

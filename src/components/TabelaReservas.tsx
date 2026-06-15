"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Valor } from "@/components/Valor";
import { eur, dataPt } from "@/lib/format";
import { CANAL_LABEL } from "@/lib/canais";
import {
  validarReservasAction,
  validarFaturarReceberAction,
} from "@/lib/actions/reservas";

export type ReservaVw = {
  id: string;
  casa: string | null;
  centro: string | null;
  canal: string | null;
  hospede: string | null;
  data_checkin: string | null;
  data_checkout: string | null;
  valor_total: number;
  iva_liquidado: number;
  recebido_total: number;
  faturado: boolean;
  fora_sopro: boolean;
  validada: boolean;
  estado: string;
  estado_temporal: string;
};

type Aba = "todas" | "ativa" | "futura" | "passada" | "cancelada";

const ABAS: { key: Aba; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "ativa", label: "Activas" },
  { key: "futura", label: "Futuras" },
  { key: "passada", label: "Passadas" },
  { key: "cancelada", label: "Canceladas" },
];

type SortKey =
  | "casa"
  | "centro"
  | "hospede"
  | "canal"
  | "data_checkin"
  | "valor_total"
  | "faturado"
  | "resultado"
  | "recebido";

function valorOrdenacao(r: ReservaVw, k: SortKey): string | number {
  switch (k) {
    case "casa":
      return (r.casa ?? "").toLowerCase();
    case "centro":
      return (r.centro ?? "").toLowerCase();
    case "hospede":
      return (r.hospede ?? "").toLowerCase();
    case "canal":
      return (CANAL_LABEL[r.canal ?? ""] ?? r.canal ?? "").toLowerCase();
    case "data_checkin":
      return r.data_checkin ?? "";
    case "valor_total":
      return Number(r.valor_total);
    case "faturado":
      return r.faturado ? 1 : 0;
    case "resultado":
      return Number(r.valor_total) - Number(r.iva_liquidado);
    case "recebido":
      return Number(r.recebido_total);
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

export function TabelaReservas({ reservas }: { reservas: ReservaVw[] }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("futura");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aValidar, startValidar] = useTransition();
  const [aFechar, startFechar] = useTransition();
  const [fCasa, setFCasa] = useState("");
  const [fCentro, setFCentro] = useState("");
  const [fCanal, setFCanal] = useState("");
  const [fValidacao, setFValidacao] = useState("");
  const [fHospede, setFHospede] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data_checkin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const casas = useMemo(
    () => [...new Set(reservas.map((r) => r.casa).filter(Boolean))].sort() as string[],
    [reservas],
  );
  const centros = useMemo(
    () => [...new Set(reservas.map((r) => r.centro).filter(Boolean))].sort() as string[],
    [reservas],
  );
  const canais = useMemo(
    () => [...new Set(reservas.map((r) => r.canal).filter(Boolean))] as string[],
    [reservas],
  );

  const contagens = useMemo(() => {
    const c: Record<string, number> = { todas: reservas.length };
    for (const r of reservas) c[r.estado_temporal] = (c[r.estado_temporal] ?? 0) + 1;
    return c;
  }, [reservas]);

  const filtradas = useMemo(() => {
    const arr = reservas.filter((r) => {
      if (aba !== "todas" && r.estado_temporal !== aba) return false;
      if (fCasa && r.casa !== fCasa) return false;
      if (fCentro && r.centro !== fCentro) return false;
      if (fCanal && r.canal !== fCanal) return false;
      if (fValidacao === "rascunho" && r.validada) return false;
      if (fValidacao === "fechada" && !r.validada) return false;
      if (fHospede && !(r.hospede ?? "").toLowerCase().includes(fHospede.toLowerCase()))
        return false;
      if (fDe && (r.data_checkin ?? "") < fDe) return false;
      if (fAte && (r.data_checkin ?? "") > fAte) return false;
      return true;
    });
    arr.sort((a, b) => {
      const va = valorOrdenacao(a, sortKey);
      const vb = valorOrdenacao(b, sortKey);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "pt");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [
    reservas,
    aba,
    fCasa,
    fCentro,
    fCanal,
    fValidacao,
    fHospede,
    fDe,
    fAte,
    sortKey,
    sortDir,
  ]);

  // Só se podem validar rascunhos com valor (não cancelados, não "por preencher").
  const selecionaveis = useMemo(
    () =>
      filtradas.filter(
        (r) => !r.validada && r.estado !== "cancelada" && Number(r.valor_total) > 0,
      ),
    [filtradas],
  );
  const totalResultado = filtradas.reduce(
    (s, r) => s + Number(r.valor_total) - Number(r.iva_liquidado),
    0,
  );
  const totalRecebido = filtradas.reduce((s, r) => s + Number(r.recebido_total), 0);

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todosSelecionados =
    selecionaveis.length > 0 && selecionaveis.every((r) => sel.has(r.id));
  const toggleTodos = () =>
    setSel(todosSelecionados ? new Set() : new Set(selecionaveis.map((r) => r.id)));

  const validarSelecionadas = () =>
    startValidar(async () => {
      await validarReservasAction([...sel]);
      setSel(new Set());
      router.refresh();
    });

  const fecharSelecionadas = () =>
    startFechar(async () => {
      await validarFaturarReceberAction([...sel]);
      setSel(new Set());
      router.refresh();
    });

  const aProcessar = aValidar || aFechar;

  const ordenarPor = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "data_checkin" ? "desc" : "asc");
    }
  };

  const seta = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const Th = ({ k, label, r }: { k: SortKey; label: string; r?: boolean }) => (
    <th
      className={r ? "al-r" : undefined}
      style={{ cursor: "pointer", userSelect: "none" }}
      onClick={() => ordenarPor(k)}
      title="Ordenar"
    >
      {label}
      {seta(k)}
    </th>
  );

  return (
    <div>
      {/* Separadores */}
      <div className="al-tabs" style={{ padding: 0, marginBottom: 14, border: "none" }}>
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`al-tab ${aba === a.key ? "on" : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setAba(a.key)}
          >
            {a.label} ({a.key === "todas" ? contagens.todas : (contagens[a.key] ?? 0)})
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}
      >
        <select value={fCasa} onChange={(e) => setFCasa(e.target.value)} style={inputStyle}>
          <option value="">Todas as casas</option>
          {casas.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={fCentro} onChange={(e) => setFCentro(e.target.value)} style={inputStyle}>
          <option value="">Todos os CCs</option>
          {centros.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} style={inputStyle}>
          <option value="">Todos os canais</option>
          {canais.map((c) => (
            <option key={c} value={c}>{CANAL_LABEL[c] ?? c}</option>
          ))}
        </select>
        <select
          value={fValidacao}
          onChange={(e) => setFValidacao(e.target.value)}
          style={inputStyle}
        >
          <option value="">Validação (todas)</option>
          <option value="rascunho">Por validar (rascunho)</option>
          <option value="fechada">Validadas (fechadas)</option>
        </select>
        <input
          placeholder="Hóspede…"
          value={fHospede}
          onChange={(e) => setFHospede(e.target.value)}
          style={inputStyle}
        />
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          Check-in de{" "}
          <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>
          a <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={inputStyle} />
        </label>
        {(fCasa || fCentro || fCanal || fValidacao || fHospede || fDe || fAte) && (
          <button
            type="button"
            className="al-back"
            style={{ padding: 0 }}
            onClick={() => {
              setFCasa(""); setFCentro(""); setFCanal(""); setFValidacao("");
              setFHospede(""); setFDe(""); setFAte("");
            }}
          >
            limpar filtros
          </button>
        )}
      </div>

      {sel.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13 }}>{sel.size} selecionada(s)</span>
          <button
            type="button"
            className="al-btn"
            onClick={validarSelecionadas}
            disabled={aProcessar}
          >
            {aValidar ? "A validar…" : "Validar"}
          </button>
          <button
            type="button"
            className="al-btn"
            onClick={fecharSelecionadas}
            disabled={aProcessar}
            title="Valida, marca faturada e recebida (data de recebimento = check-in)"
          >
            {aFechar ? "A fechar…" : "Validar, faturar e receber"}
          </button>
          <button
            type="button"
            className="al-back"
            style={{ padding: 0 }}
            onClick={() => setSel(new Set())}
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
                  checked={todosSelecionados}
                  onChange={toggleTodos}
                  title="Selecionar todas (validáveis)"
                />
              </th>
              <Th k="casa" label="Casa" />
              <Th k="hospede" label="Hóspede" />
              <Th k="canal" label="Canal" />
              <Th k="data_checkin" label="Check-in" />
              <Th k="valor_total" label="Valor total" r />
              <Th k="faturado" label="Faturado" />
              <Th k="resultado" label="Resultado s/ IVA" r />
              <Th k="recebido" label="Recebido" r />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => {
              const cancelada = r.estado === "cancelada";
              const porPreencher = !r.validada && Number(r.valor_total) === 0;
              const selecionavel =
                !r.validada && !cancelada && Number(r.valor_total) > 0;
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => router.push(`/reservas/${r.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/reservas/${r.id}`)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    {selecionavel && (
                      <input
                        type="checkbox"
                        checked={sel.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    )}
                  </td>
                  <td style={cancelada ? { opacity: 0.55 } : undefined}>
                    <span className="al-cc-nome">{r.casa ?? "—"}</span>
                    <span className="al-dim" style={{ marginLeft: 8 }}>{r.centro}</span>
                    {r.validada ? (
                      <span className="al-chip al-chip-ok" style={{ marginLeft: 8 }}>fechada</span>
                    ) : (
                      <span className="al-tag">rascunho</span>
                    )}
                    {cancelada && <span className="al-tag">cancelada</span>}
                    {porPreencher && <span className="al-tag">por preencher</span>}
                    {r.fora_sopro && <span className="al-tag">por fora</span>}
                  </td>
                  <td className="al-dim">{r.hospede ?? "—"}</td>
                  <td>{CANAL_LABEL[r.canal ?? ""] ?? r.canal ?? "—"}</td>
                  <td className="al-mono">{dataPt(r.data_checkin)}</td>
                  <td className="al-r">
                    <Valor n={Number(r.valor_total)} dim={porPreencher} />
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
                      n={Number(r.valor_total) - Number(r.iva_liquidado)}
                      forte={!porPreencher && !cancelada}
                      dim={porPreencher || cancelada}
                    />
                  </td>
                  <td className="al-r">
                    <Valor n={Number(r.recebido_total)} dim={Number(r.recebido_total) === 0} />
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={9} className="al-hint" style={{ padding: 24 }}>
                  Nenhuma reserva com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
          {filtradas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={7} className="al-r" style={{ fontWeight: 600 }}>
                  Totais ({filtradas.length})
                </td>
                <td className="al-r">
                  <span className="al-num al-pos">{eur(totalResultado)}</span>
                </td>
                <td className="al-r">
                  <span className="al-num">{eur(totalRecebido)}</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="al-hint">
        Carrega numa linha para editar e validar; num cabeçalho para ordenar.
        Marca as caixas (só rascunhos com valor) para{" "}
        <strong>validar várias</strong> de uma vez, ou{" "}
        <strong>validar, faturar e receber</strong> — esta última pré-regista a
        data de recebimento igual ao check-in de cada reserva.
      </p>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Valor } from "@/components/Valor";
import { dataPt } from "@/lib/format";
import { CANAL_LABEL } from "@/lib/canais";

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
  liquido: number;
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
  | "liquido"
  | "liquido_iva";

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
    case "liquido":
      return Number(r.liquido);
    case "liquido_iva":
      return Number(r.liquido) - Number(r.iva_liquidado);
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
  const [aba, setAba] = useState<Aba>("todas");
  const [fCasa, setFCasa] = useState("");
  const [fCentro, setFCentro] = useState("");
  const [fCanal, setFCanal] = useState("");
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
  }, [reservas, aba, fCasa, fCentro, fCanal, fHospede, fDe, fAte, sortKey, sortDir]);

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
        {(fCasa || fCentro || fCanal || fHospede || fDe || fAte) && (
          <button
            type="button"
            className="al-back"
            style={{ padding: 0 }}
            onClick={() => {
              setFCasa(""); setFCentro(""); setFCanal(""); setFHospede(""); setFDe(""); setFAte("");
            }}
          >
            limpar filtros
          </button>
        )}
      </div>

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <Th k="casa" label="Casa" />
              <Th k="hospede" label="Hóspede" />
              <Th k="canal" label="Canal" />
              <Th k="data_checkin" label="Check-in" />
              <Th k="valor_total" label="Valor total" r />
              <Th k="faturado" label="Faturado" />
              <Th k="liquido" label="Líquido" r />
              <Th k="liquido_iva" label="Líquido s/ IVA" r />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => {
              const cancelada = r.estado === "cancelada";
              const porPreencher = !r.validada && Number(r.valor_total) === 0;
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => router.push(`/reservas/${r.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/reservas/${r.id}`)}
                >
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
                    <Valor n={Number(r.liquido)} dim={porPreencher || cancelada} />
                  </td>
                  <td className="al-r">
                    <Valor
                      n={Number(r.liquido) - Number(r.iva_liquidado)}
                      forte={!porPreencher && !cancelada}
                      dim={porPreencher || cancelada}
                    />
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={8} className="al-hint" style={{ padding: 24 }}>
                  Nenhuma reserva com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="al-hint">
        {filtradas.length} reserva(s). Carrega numa linha para editar e validar;
        carrega num cabeçalho para ordenar.
      </p>
    </div>
  );
}

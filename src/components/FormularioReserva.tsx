"use client";

import { useActionState, useState } from "react";
import {
  criarReservaAction,
  atualizarReservaAction,
  type ReservaState,
} from "@/lib/actions/reservas";
import { inputStyle, labelStyle } from "./AccaoPanel";
import { CANAIS_OPCOES } from "@/lib/canais";
import { eur } from "@/lib/format";

export type Casa = { id: string; nome: string; ccNome: string };

export type ValoresReserva = {
  casa_id: string;
  canal: string;
  data_checkin: string;
  data_checkout: string;
  data_faturacao: string;
  valor_total: string;
  iva_liquidado: string;
  faturado: boolean;
  fora_sopro: boolean;
  hospede: string;
  estado: string;
  validada: boolean;
};

export type LinhaRecebimento = { valor: string; data: string };

const VAZIO: ValoresReserva = {
  casa_id: "",
  canal: "",
  data_checkin: "",
  data_checkout: "",
  data_faturacao: "",
  valor_total: "0",
  iva_liquidado: "0",
  faturado: false,
  fora_sopro: false,
  hospede: "",
  estado: "ativa",
  validada: false,
};

const arred2 = (n: number) => Math.round(n * 100) / 100;

export function FormularioReserva({
  casas,
  modo,
  reservaId,
  inicial,
  onConcluir,
  ivasPorCasa = {},
  recebimentosIniciais = [],
}: {
  casas: Casa[];
  modo: "criar" | "editar";
  reservaId?: string;
  inicial?: Partial<ValoresReserva>;
  onConcluir?: () => void;
  ivasPorCasa?: Record<string, number>;
  recebimentosIniciais?: LinhaRecebimento[];
}) {
  const [v, setV] = useState<ValoresReserva>({ ...VAZIO, ...inicial });
  const ivaPctInicial = (() => {
    const val = Number(inicial?.valor_total) || 0;
    const iva = Number(inicial?.iva_liquidado) || 0;
    return val > iva && iva > 0 ? String(arred2((iva * 100) / (val - iva))) : "0";
  })();
  const [ivaPct, setIvaPct] = useState(ivaPctInicial);
  const [recebimentos, setRecebimentos] = useState<LinhaRecebimento[]>(
    recebimentosIniciais.length > 0 ? recebimentosIniciais : [],
  );
  const [state, action, pending] = useActionState<ReservaState, FormData>(
    modo === "criar" ? criarReservaAction : atualizarReservaAction,
    {},
  );

  const set = (campo: keyof ValoresReserva, valor: string | boolean) =>
    setV((prev) => ({ ...prev, [campo]: valor }));

  const onCasa = (casaId: string) => {
    set("casa_id", casaId);
    const padrao = ivasPorCasa[casaId];
    if (padrao !== undefined) setIvaPct(String(padrao));
  };

  const valorTotal = Number(v.valor_total) || 0;
  const ivaP = Number(ivaPct) || 0;
  const ivaEuros = ivaP > 0 ? arred2((valorTotal * ivaP) / (100 + ivaP)) : 0;
  const resultado = arred2(valorTotal - ivaEuros);
  const totalRecebido = recebimentos.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const bloqueado = !!v.validada;

  const recebimentosJson = JSON.stringify(
    recebimentos
      .filter((r) => Number(r.valor))
      .map((r) => ({ valor: Number(r.valor), data: r.data || null })),
  );

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {modo === "editar" && reservaId && (
        <input type="hidden" name="id" value={reservaId} />
      )}
      <input type="hidden" name="iva_liquidado" value={ivaEuros} />
      <input type="hidden" name="recebimentos" value={recebimentosJson} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="casa_id">Casa</label>
          <select
            id="casa_id"
            name="casa_id"
            style={inputStyle}
            value={v.casa_id}
            onChange={(e) => onCasa(e.target.value)}
          >
            <option value="" disabled>Escolhe a casa…</option>
            {casas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} · {c.ccNome}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="canal">Canal</label>
          <select
            id="canal"
            name="canal"
            style={inputStyle}
            value={v.canal}
            onChange={(e) => set("canal", e.target.value)}
          >
            <option value="" disabled>Escolhe…</option>
            {CANAIS_OPCOES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="hospede">Hóspede (nome)</label>
          <input
            id="hospede"
            name="hospede"
            style={inputStyle}
            value={v.hospede}
            onChange={(e) => set("hospede", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="estado">Estado</label>
          <select
            id="estado"
            name="estado"
            style={inputStyle}
            value={v.estado}
            onChange={(e) => set("estado", e.target.value)}
          >
            <option value="ativa">Ativa</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="data_checkin">Check-in</label>
          <input id="data_checkin" name="data_checkin" type="date" style={inputStyle}
            value={v.data_checkin} onChange={(e) => set("data_checkin", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="data_checkout">Check-out</label>
          <input id="data_checkout" name="data_checkout" type="date" style={inputStyle}
            value={v.data_checkout} onChange={(e) => set("data_checkout", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="data_faturacao">Data de faturação</label>
          <input id="data_faturacao" name="data_faturacao" type="date" style={inputStyle}
            readOnly={bloqueado}
            value={v.data_faturacao} onChange={(e) => set("data_faturacao", e.target.value)} />
          <span className="al-hint" style={{ fontSize: 12 }}>vazio = data do check-in</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="valor_total">Valor faturado (€)</label>
          <input id="valor_total" name="valor_total" type="number" step="0.01" min="0"
            readOnly={bloqueado} style={inputStyle}
            value={v.valor_total} onChange={(e) => set("valor_total", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="iva_pct">IVA (%)</label>
          <input id="iva_pct" type="number" step="0.01" min="0" max="100"
            readOnly={bloqueado} style={inputStyle}
            value={ivaPct} onChange={(e) => setIvaPct(e.target.value)} />
          <span className="al-hint" style={{ fontSize: 12 }}>
            incluído no preço = <span className="al-num">{eur(ivaEuros)}</span>
          </span>
        </div>
      </div>

      {/* Recebimentos (lista) */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={labelStyle}>Recebimentos (valor líquido que caiu na conta + data)</span>
          <span className="al-num" style={{ fontSize: 13 }}>
            recebido: {eur(totalRecebido)}
          </span>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {recebimentos.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 8 }}>
              <input type="number" step="0.01" min="0" placeholder="valor (€)"
                style={{ ...inputStyle, textAlign: "right" }}
                value={r.valor}
                onChange={(e) =>
                  setRecebimentos((ls) => ls.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))
                } />
              <input type="date" style={inputStyle}
                value={r.data}
                onChange={(e) =>
                  setRecebimentos((ls) => ls.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))
                } />
              <button type="button" className="al-back" style={{ padding: 0 }} title="Remover"
                onClick={() => setRecebimentos((ls) => ls.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {recebimentos.length === 0 && (
            <span className="al-hint" style={{ margin: 0 }}>Sem recebimentos ainda.</span>
          )}
        </div>
        <button type="button" className="al-back" style={{ padding: "8px 0 0" }}
          onClick={() => setRecebimentos((ls) => [...ls, { valor: "", data: v.data_checkin }])}>
          + Adicionar recebimento
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" name="faturado" checked={v.faturado} onChange={(e) => set("faturado", e.target.checked)} />
          Faturado
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" name="fora_sopro" checked={v.fora_sopro} onChange={(e) => set("fora_sopro", e.target.checked)} />
          Gerida fora da Sopro
        </label>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          Resultado (s/ IVA): <span className="al-num al-pos">{eur(resultado)}</span>
        </span>
      </div>

      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 13, margin: 0 }}>{state.error}</p>
      )}
      {bloqueado && (
        <p className="al-hint" style={{ margin: 0 }}>
          Reserva <strong>fechada</strong> (no livro). Para corrigir os valores,{" "}
          <strong>Desvalida</strong> primeiro. Recebimentos podem ser geridos e
          re-lançam automaticamente.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="submit" name="validada" value="false" className="al-back"
          style={{ padding: "9px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
          disabled={pending}>
          {pending ? "A guardar…" : "Guardar (rascunho)"}
        </button>
        <button type="submit" name="validada" value="true" className="al-btn" disabled={pending}>
          {bloqueado ? "Guardar (fechada)" : "Validar e fechar"}
        </button>
        {onConcluir && (
          <button type="button" className="al-back" style={{ padding: "9px 0" }} onClick={onConcluir}>
            Cancelar
          </button>
        )}
      </div>
      <p className="al-hint" style={{ margin: 0 }}>
        <strong>Faturação</strong> lança Resultado (s/ IVA) e IVA na data de faturação.
        Cada <strong>recebimento</strong> entra em Tesouraria na sua data. As taxas de
        plataforma entram à parte, como custos.
      </p>
    </form>
  );
}

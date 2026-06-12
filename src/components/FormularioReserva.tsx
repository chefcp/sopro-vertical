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
  valor_total: string;
  iva_liquidado: string;
  taxa_canal: string;
  comissao_stripe: string;
  faturado: boolean;
  fora_sopro: boolean;
  hospede: string;
  estado: string;
  recebido: boolean;
  data_recebimento: string;
  valor_recebido: string;
  validada: boolean;
};

const VAZIO: ValoresReserva = {
  casa_id: "",
  canal: "",
  data_checkin: "",
  data_checkout: "",
  valor_total: "0",
  iva_liquidado: "0",
  taxa_canal: "0",
  comissao_stripe: "0",
  faturado: false,
  fora_sopro: false,
  hospede: "",
  estado: "ativa",
  recebido: false,
  data_recebimento: "",
  valor_recebido: "",
  validada: false,
};

const arred2 = (n: number) => Math.round(n * 100) / 100;

export function FormularioReserva({
  casas,
  modo,
  reservaId,
  inicial,
  onConcluir,
  taxasPorCanal = {},
  ivasPorCasa = {},
}: {
  casas: Casa[];
  modo: "criar" | "editar";
  reservaId?: string;
  inicial?: Partial<ValoresReserva>;
  onConcluir?: () => void;
  taxasPorCanal?: Record<string, number>;
  ivasPorCasa?: Record<string, number>;
}) {
  const [v, setV] = useState<ValoresReserva>({ ...VAZIO, ...inicial });
  // Taxa do canal em percentagem (calcula o € a partir do valor total).
  const pctInicial = (() => {
    const val = Number(inicial?.valor_total) || 0;
    const tx = Number(inicial?.taxa_canal) || 0;
    return val > 0 && tx > 0 ? String(arred2((tx / val) * 100)) : "0";
  })();
  const [taxaPct, setTaxaPct] = useState(pctInicial);
  // IVA em percentagem (incluído no preço): iva = valor × p ÷ (100+p).
  const ivaPctInicial = (() => {
    const val = Number(inicial?.valor_total) || 0;
    const iva = Number(inicial?.iva_liquidado) || 0;
    return val > iva && iva > 0
      ? String(arred2((iva * 100) / (val - iva)))
      : "0";
  })();
  const [ivaPct, setIvaPct] = useState(ivaPctInicial);
  const [state, action, pending] = useActionState<ReservaState, FormData>(
    modo === "criar" ? criarReservaAction : atualizarReservaAction,
    {},
  );

  const set = (campo: keyof ValoresReserva, valor: string | boolean) =>
    setV((prev) => ({ ...prev, [campo]: valor }));

  const onCanal = (canal: string) => {
    set("canal", canal);
    // Pré-preenche a taxa do canal com o valor parametrizado (editável depois).
    const padrao = taxasPorCanal[canal];
    if (padrao !== undefined) setTaxaPct(String(padrao));
  };

  const onCasa = (casaId: string) => {
    set("casa_id", casaId);
    const padrao = ivasPorCasa[casaId];
    if (padrao !== undefined) setIvaPct(String(padrao));
  };

  const valorTotal = Number(v.valor_total) || 0;
  const taxaEuros = arred2((valorTotal * (Number(taxaPct) || 0)) / 100);
  const ivaP = Number(ivaPct) || 0;
  const ivaEuros = ivaP > 0 ? arred2((valorTotal * ivaP) / (100 + ivaP)) : 0;
  const liquido = valorTotal - taxaEuros - (Number(v.comissao_stripe) || 0);
  // O que sobra depois de entregar o IVA ao Estado (o que se pode mesmo levantar).
  const liquidoSemIva = liquido - ivaEuros;
  // Fechada (validada): os campos financeiros ficam bloqueados (readOnly mantém-nos no envio).
  const bloqueado = !!v.validada;

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {modo === "editar" && reservaId && (
        <input type="hidden" name="id" value={reservaId} />
      )}
      {/* Taxa e IVA são guardados em € (calculados das percentagens). */}
      <input type="hidden" name="taxa_canal" value={taxaEuros} />
      <input type="hidden" name="iva_liquidado" value={ivaEuros} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="casa_id">
            Casa
          </label>
          <select
            id="casa_id"
            name="casa_id"
            style={inputStyle}
            value={v.casa_id}
            onChange={(e) => onCasa(e.target.value)}
          >
            <option value="" disabled>
              Escolhe a casa…
            </option>
            {casas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {c.ccNome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="canal">
            Canal
          </label>
          <select
            id="canal"
            name="canal"
            style={inputStyle}
            value={v.canal}
            onChange={(e) => onCanal(e.target.value)}
          >
            <option value="" disabled>
              Escolhe…
            </option>
            {CANAIS_OPCOES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="hospede">
            Hóspede (nome)
          </label>
          <input
            id="hospede"
            name="hospede"
            style={inputStyle}
            value={v.hospede}
            onChange={(e) => set("hospede", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="estado">
            Estado
          </label>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="data_checkin">
            Check-in
          </label>
          <input
            id="data_checkin"
            name="data_checkin"
            type="date"
            style={inputStyle}
            value={v.data_checkin}
            onChange={(e) => set("data_checkin", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="data_checkout">
            Check-out
          </label>
          <input
            id="data_checkout"
            name="data_checkout"
            type="date"
            style={inputStyle}
            value={v.data_checkout}
            onChange={(e) => set("data_checkout", e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="valor_total">
            Valor total (€)
          </label>
          <input
            id="valor_total"
            name="valor_total"
            type="number"
            step="0.01"
            min="0"
            readOnly={bloqueado}
            style={inputStyle}
            value={v.valor_total}
            onChange={(e) => set("valor_total", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="iva_pct">
            IVA (%)
          </label>
          <input
            id="iva_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            readOnly={bloqueado}
            style={inputStyle}
            value={ivaPct}
            onChange={(e) => setIvaPct(e.target.value)}
          />
          <span className="al-hint" style={{ fontSize: 12 }}>
            incluído no preço = <span className="al-num">{eur(ivaEuros)}</span> a
            entregar ao Estado
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="taxa_canal_pct">
            Taxa do canal (%)
          </label>
          <input
            id="taxa_canal_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            readOnly={bloqueado}
            style={inputStyle}
            value={taxaPct}
            onChange={(e) => setTaxaPct(e.target.value)}
          />
          <span className="al-hint" style={{ fontSize: 12 }}>
            = <span className="al-num">{eur(taxaEuros)}</span> sobre o valor total
          </span>
        </div>
        <div>
          <label style={labelStyle} htmlFor="comissao_stripe">
            Comissão Stripe (€)
          </label>
          <input
            id="comissao_stripe"
            name="comissao_stripe"
            type="number"
            step="0.01"
            min="0"
            readOnly={bloqueado}
            style={inputStyle}
            value={v.comissao_stripe}
            onChange={(e) => set("comissao_stripe", e.target.value)}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            name="faturado"
            checked={v.faturado}
            onChange={(e) => set("faturado", e.target.checked)}
          />
          Faturado
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            name="fora_sopro"
            checked={v.fora_sopro}
            onChange={(e) => set("fora_sopro", e.target.checked)}
          />
          Gerida fora da Sopro
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            name="recebido"
            checked={v.recebido}
            onChange={(e) => set("recebido", e.target.checked)}
          />
          Recebido (total)
        </label>
        <label
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}
        >
          Recebido (€)
          <input
            name="valor_recebido"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="parcial"
            value={v.valor_recebido}
            onChange={(e) => set("valor_recebido", e.target.value)}
            style={{ ...inputStyle, width: 110 }}
            title="Valor já recebido (parcial). Vazio = usa 'Recebido (total)'."
          />
        </label>
        {(v.recebido || v.valor_recebido) && (
          <input
            name="data_recebimento"
            type="date"
            value={v.data_recebimento}
            onChange={(e) => set("data_recebimento", e.target.value)}
            style={{ ...inputStyle, width: 160 }}
            title="Data de recebimento (opcional)"
          />
        )}
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          Líquido: <span className="al-num">{eur(liquido)}</span> · s/ IVA:{" "}
          <span className="al-num al-pos">{eur(liquidoSemIva)}</span>
        </span>
      </div>

      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 13, margin: 0 }}>
          {state.error}
        </p>
      )}

      {bloqueado && (
        <p className="al-hint" style={{ margin: 0 }}>
          Reserva <strong>fechada</strong> (no livro). Os valores estão
          bloqueados — para os corrigir, <strong>Desvalida</strong> primeiro (em
          cima). Podes ainda mudar estado, faturado e recebido e guardar.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* Guardar = rascunho (fora do livro). Validar = fecha e lança via trigger. */}
        <button
          type="submit"
          name="validada"
          value="false"
          className="al-back"
          style={{ padding: "9px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
          disabled={pending}
        >
          {pending ? "A guardar…" : "Guardar (rascunho)"}
        </button>
        <button
          type="submit"
          name="validada"
          value="true"
          className="al-btn"
          disabled={pending}
        >
          {bloqueado ? "Guardar (fechada)" : "Validar e fechar"}
        </button>
        {onConcluir && (
          <button
            type="button"
            className="al-back"
            style={{ padding: "9px 0" }}
            onClick={onConcluir}
          >
            Cancelar
          </button>
        )}
      </div>
      <p className="al-hint" style={{ margin: 0 }}>
        <strong>Guardar</strong> deixa em rascunho (não entra no livro).{" "}
        <strong>Validar e fechar</strong> lança no livro (resultado e IVA; a
        tesouraria entra com o <em>Recebido (total)</em>, ou só o{" "}
        <em>Recebido (€)</em> parcial se ainda não caiu tudo — atualizas o número
        à medida que vai caindo).
      </p>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { lancarManualAction, type AccaoState } from "@/lib/actions/livro";
import { AccaoPanel, inputStyle, labelStyle } from "./AccaoPanel";

const CONTAS: { value: string; label: string }[] = [
  { value: "tesouraria", label: "Tesouraria" },
  { value: "suprimentos", label: "Suprimentos" },
  { value: "resultado", label: "Resultado" },
  { value: "iva", label: "IVA" },
];

export function BotaoLancamentoManual({ cc }: { cc: string }) {
  return (
    <AccaoPanel label="Lançamento manual">
      {(fechar) => <Form cc={cc} fechar={fechar} />}
    </AccaoPanel>
  );
}

function Form({ cc, fechar }: { cc: string; fechar: () => void }) {
  const [state, action, pending] = useActionState<AccaoState, FormData>(
    lancarManualAction,
    {},
  );

  useEffect(() => {
    if (state.mensagem) fechar();
  }, [state.mensagem, fechar]);

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="cc" value={cc} />
      <div>
        <label style={labelStyle} htmlFor="conta_manual">
          Conta
        </label>
        <select id="conta_manual" name="conta" style={inputStyle} defaultValue="tesouraria">
          {CONTAS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
        <div>
          <label style={labelStyle} htmlFor="sinal_manual">
            Sentido
          </label>
          <select id="sinal_manual" name="sinal" style={inputStyle} defaultValue="+">
            <option value="+">Entra (+)</option>
            <option value="-">Sai (−)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="valor_manual">
            Valor (€)
          </label>
          <input
            id="valor_manual"
            name="valor"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="descricao_manual">
          Descrição
        </label>
        <input
          id="descricao_manual"
          name="descricao"
          placeholder="ex.: comissão bancária"
          style={inputStyle}
        />
      </div>
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" className="al-btn" disabled={pending}>
        {pending ? "A registar…" : "Registar"}
      </button>
      <p className="al-hint" style={{ margin: 0 }}>
        Lança a uma conta deste CC (origem &quot;manual&quot;). Sem travão — os
        saldos podem ficar negativos.
      </p>
    </form>
  );
}

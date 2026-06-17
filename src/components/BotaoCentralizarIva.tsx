"use client";

import { useActionState, useEffect } from "react";
import { centralizarIvaAction, type AccaoState } from "@/lib/actions/livro";
import { AccaoPanel, inputStyle, labelStyle } from "./AccaoPanel";

export function BotaoCentralizarIva({ cc }: { cc: string }) {
  return (
    <AccaoPanel label="IVA na Sopro">
      {(fechar) => <Form cc={cc} fechar={fechar} />}
    </AccaoPanel>
  );
}

function Form({ cc, fechar }: { cc: string; fechar: () => void }) {
  const [state, action, pending] = useActionState<AccaoState, FormData>(
    centralizarIvaAction,
    {},
  );

  useEffect(() => {
    if (state.mensagem) fechar();
  }, [state.mensagem, fechar]);

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="cc" value={cc} />
      <div>
        <label style={labelStyle} htmlFor="valor_iva">
          Valor do IVA (€)
        </label>
        <input
          id="valor_iva"
          name="valor"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          style={inputStyle}
        />
      </div>
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" className="al-btn" disabled={pending}>
        {pending ? "A registar…" : "Centralizar"}
      </button>
      <p className="al-hint" style={{ margin: 0 }}>
        Os donos deixam o IVA na empresa: o IVA e a tesouraria correspondente
        passam deste CC para o Geral (Sopro).
      </p>
    </form>
  );
}

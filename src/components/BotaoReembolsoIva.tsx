"use client";

import { useActionState, useEffect } from "react";
import {
  distribuirReembolsoIvaAction,
  type AccaoState,
} from "@/lib/actions/livro";
import { AccaoPanel, inputStyle, labelStyle } from "./AccaoPanel";

export function BotaoReembolsoIva() {
  return (
    <AccaoPanel label="Reembolso de IVA">
      {(fechar) => <Form fechar={fechar} />}
    </AccaoPanel>
  );
}

function Form({ fechar }: { fechar: () => void }) {
  const [state, action, pending] = useActionState<AccaoState, FormData>(
    distribuirReembolsoIvaAction,
    {},
  );

  useEffect(() => {
    if (state.mensagem) fechar();
  }, [state.mensagem, fechar]);

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div>
        <label style={labelStyle} htmlFor="valor_iva">
          Valor recebido (€)
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
        {pending ? "A distribuir…" : "Distribuir reembolso"}
      </button>
      <p className="al-hint" style={{ margin: 0 }}>
        Distribui o reembolso recebido pelos centros de custo, até ao saldo de
        IVA de cada um.
      </p>
    </form>
  );
}

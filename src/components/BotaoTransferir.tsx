"use client";

import { useActionState, useEffect } from "react";
import { transferirCcAction, type AccaoState } from "@/lib/actions/livro";
import { AccaoPanel, inputStyle, labelStyle } from "./AccaoPanel";

type CC = { id: string; nome: string };

export function BotaoTransferir({
  cc,
  outrosCentros,
}: {
  cc: string;
  outrosCentros: CC[];
}) {
  return (
    <AccaoPanel label="Transferir entre CCs">
      {(fechar) => <Form cc={cc} outrosCentros={outrosCentros} fechar={fechar} />}
    </AccaoPanel>
  );
}

function Form({
  cc,
  outrosCentros,
  fechar,
}: {
  cc: string;
  outrosCentros: CC[];
  fechar: () => void;
}) {
  const [state, action, pending] = useActionState<AccaoState, FormData>(
    transferirCcAction,
    {},
  );

  useEffect(() => {
    if (state.mensagem) fechar();
  }, [state.mensagem, fechar]);

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="origem_cc" value={cc} />
      <div>
        <label style={labelStyle} htmlFor="destino_cc">
          Para o centro de custo
        </label>
        <select id="destino_cc" name="destino_cc" style={inputStyle} defaultValue="">
          <option value="" disabled>
            Escolhe o destino…
          </option>
          {outrosCentros.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle} htmlFor="valor_transf">
          Valor (€)
        </label>
        <input
          id="valor_transf"
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
        {pending ? "A transferir…" : "Transferir"}
      </button>
      <p className="al-hint" style={{ margin: 0 }}>
        Move o valor pela conta-corrente: sai deste CC, entra no destino.
      </p>
    </form>
  );
}

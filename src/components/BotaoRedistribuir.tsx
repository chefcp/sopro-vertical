"use client";

import { useActionState, useEffect } from "react";
import { redistribuirContaAction, type AccaoState } from "@/lib/actions/livro";
import { AccaoPanel, inputStyle, labelStyle } from "./AccaoPanel";

const CONTAS: { value: string; label: string }[] = [
  { value: "tesouraria", label: "Tesouraria" },
  { value: "resultado", label: "Resultado" },
  { value: "suprimentos", label: "Suprimentos" },
  { value: "iva", label: "IVA" },
  { value: "cc_corrente", label: "Conta-corrente" },
];

export function BotaoRedistribuir({ cc }: { cc: string }) {
  return (
    <AccaoPanel label="Redistribuir conta">
      {(fechar) => <Form cc={cc} fechar={fechar} />}
    </AccaoPanel>
  );
}

function Form({ cc, fechar }: { cc: string; fechar: () => void }) {
  const [state, action, pending] = useActionState<AccaoState, FormData>(
    redistribuirContaAction,
    {},
  );

  useEffect(() => {
    if (state.mensagem) fechar();
  }, [state.mensagem, fechar]);

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="cc" value={cc} />
      <div>
        <label style={labelStyle} htmlFor="conta">
          Conta a redistribuir
        </label>
        <select id="conta" name="conta" style={inputStyle} defaultValue="">
          <option value="" disabled>
            Escolhe a conta…
          </option>
          {CONTAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" className="al-btn" disabled={pending}>
        {pending ? "A redistribuir…" : "Redistribuir"}
      </button>
      <p className="al-hint" style={{ margin: 0 }}>
        Reparte o saldo desta conta pelos destinos da chave de repartição.
      </p>
    </form>
  );
}

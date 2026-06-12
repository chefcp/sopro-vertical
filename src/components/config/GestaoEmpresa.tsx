"use client";

import { useActionState } from "react";
import { guardarEmpresaAction, type ConfigState } from "@/lib/actions/config";
import { inputStyle, labelStyle } from "@/components/AccaoPanel";

export function GestaoEmpresa({
  nif,
  morada,
}: {
  nif: string;
  morada: string;
}) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(
    guardarEmpresaAction,
    {},
  );

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>NIF</label>
          <input
            name="nif"
            defaultValue={nif}
            placeholder="514532998"
            inputMode="numeric"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Morada (opcional)</label>
          <input name="morada" defaultValue={morada} style={inputStyle} />
        </div>
      </div>
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
      {state.mensagem && (
        <p className="al-pos" style={{ fontSize: 12.5, margin: 0 }}>
          {state.mensagem}
        </p>
      )}
      <div>
        <button type="submit" className="al-btn" disabled={pending}>
          {pending ? "A guardar…" : "Guardar dados da empresa"}
        </button>
      </div>
      <p className="al-hint" style={{ margin: 0 }}>
        O NIF serve para validar que as faturas importadas são dirigidas à Sopro
        (campo do adquirente no QR fiscal).
      </p>
    </form>
  );
}

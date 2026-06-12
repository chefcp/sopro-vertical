"use client";

import { useActionState } from "react";
import {
  guardarTaxasCanalAction,
  type ConfigState,
} from "@/lib/actions/config";
import { inputStyle, labelStyle } from "@/components/AccaoPanel";
import { CANAL_LABEL } from "@/lib/canais";

const CANAIS = ["airbnb", "vrbo", "proprio", "por_fora", "outro"];

export function GestaoTaxas({
  taxas,
}: {
  taxas: Record<string, number>;
}) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(
    guardarTaxasCanalAction,
    {},
  );

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
        }}
      >
        {CANAIS.map((c) => (
          <div key={c}>
            <label style={labelStyle}>{CANAL_LABEL[c] ?? c} (%)</label>
            <input
              name={`pct_${c}`}
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={String(taxas[c] ?? 0)}
              style={{ ...inputStyle, textAlign: "right" }}
            />
          </div>
        ))}
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
          {pending ? "A guardar…" : "Guardar taxas"}
        </button>
      </div>
      <p className="al-hint" style={{ margin: 0 }}>
        Ao criar/editar uma reserva, a taxa do canal é pré-preenchida com esta
        percentagem (podes alterar caso a caso).
      </p>
    </form>
  );
}

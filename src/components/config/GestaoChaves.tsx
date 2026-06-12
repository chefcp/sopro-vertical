"use client";

import { useActionState } from "react";
import {
  criarChaveAction,
  removerChaveAction,
  type ConfigState,
} from "@/lib/actions/config";
import { inputStyle, labelStyle } from "@/components/AccaoPanel";

type CC = { id: string; nome: string };
type Chave = {
  id: string;
  origem_cc_id: string;
  destino_cc_id: string;
  conta: string;
  peso: number;
};

const CONTAS = [
  { value: "resultado", label: "Resultado" },
  { value: "tesouraria", label: "Tesouraria" },
  { value: "suprimentos", label: "Suprimentos" },
  { value: "iva", label: "IVA" },
];

const CONTA_LABEL: Record<string, string> = Object.fromEntries(
  CONTAS.map((c) => [c.value, c.label]),
);

export function GestaoChaves({
  chaves,
  centros,
}: {
  chaves: Chave[];
  centros: CC[];
}) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(
    criarChaveAction,
    {},
  );
  const nome = new Map(centros.map((c) => [c.id, c.nome]));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        {chaves.map((ch) => (
          <div
            key={ch.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              borderBottom: "1px solid var(--line)",
              paddingBottom: 6,
            }}
          >
            <span style={{ flex: 1 }}>
              {nome.get(ch.origem_cc_id) ?? "—"} →{" "}
              {nome.get(ch.destino_cc_id) ?? "—"}
              <span className="al-tag">{CONTA_LABEL[ch.conta] ?? ch.conta}</span>
            </span>
            <span className="al-num al-dim">peso {Number(ch.peso)}</span>
            <form action={removerChaveAction}>
              <input type="hidden" name="id" value={ch.id} />
              <button type="submit" className="al-back" style={{ padding: 0 }} title="Remover">
                ✕
              </button>
            </form>
          </div>
        ))}
        {chaves.length === 0 && (
          <p className="al-hint" style={{ margin: 0 }}>
            Ainda não há chaves de repartição.
          </p>
        )}
      </div>

      <form
        action={action}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 80px auto",
          gap: 8,
          alignItems: "end",
          borderTop: "1px solid var(--line)",
          paddingTop: 12,
        }}
      >
        <div>
          <label style={labelStyle}>Origem</label>
          <select name="origem_cc_id" style={inputStyle} defaultValue="">
            <option value="" disabled>
              CC…
            </option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Destino</label>
          <select name="destino_cc_id" style={inputStyle} defaultValue="">
            <option value="" disabled>
              CC…
            </option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Conta</label>
          <select name="conta" style={inputStyle} defaultValue="">
            <option value="" disabled>
              Conta…
            </option>
            {CONTAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Peso</label>
          <input name="peso" type="number" step="0.01" min="0" style={inputStyle} />
        </div>
        <button type="submit" className="al-btn" disabled={pending}>
          {pending ? "…" : "Adicionar"}
        </button>
      </form>
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
    </div>
  );
}

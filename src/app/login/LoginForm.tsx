"use client";

import { useActionState, useState } from "react";
import {
  signIn,
  signInMagicLink,
  type AuthState,
} from "@/lib/actions/auth";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 14,
  background: "var(--paper)",
  color: "var(--ink)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--muted)",
  display: "block",
  marginBottom: 6,
};

export function LoginForm() {
  const [modo, setModo] = useState<"password" | "magic">("password");
  const action = modo === "password" ? signIn : signInMagicLink;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: 14 }}>
      <div>
        <label style={labelStyle} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          style={inputStyle}
        />
      </div>

      {modo === "password" && (
        <div>
          <label style={labelStyle} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={inputStyle}
          />
        </div>
      )}

      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 13, margin: 0 }}>
          {state.error}
        </p>
      )}
      {state.mensagem && (
        <p className="al-pos" style={{ fontSize: 13, margin: 0 }}>
          {state.mensagem}
        </p>
      )}

      <button type="submit" className="al-btn" disabled={pending}>
        {pending
          ? "A processar…"
          : modo === "password"
            ? "Entrar"
            : "Enviar ligação de acesso"}
      </button>

      <button
        type="button"
        className="al-back"
        style={{ padding: 0, textAlign: "center" }}
        onClick={() => setModo(modo === "password" ? "magic" : "password")}
      >
        {modo === "password"
          ? "Entrar com ligação por email"
          : "Entrar com password"}
      </button>
    </form>
  );
}

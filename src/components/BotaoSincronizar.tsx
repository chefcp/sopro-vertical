"use client";

import { useActionState } from "react";
import { sincronizarAction, type SyncState } from "@/lib/actions/sync";

export function BotaoSincronizar() {
  const [state, action, pending] = useActionState<SyncState, FormData>(
    sincronizarAction,
    {},
  );

  return (
    <form action={action} style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {/* Sem `desde` → janela por defeito (1 mês atrás → futuro). */}
      <button type="submit" className="al-btn" disabled={pending}>
        {pending ? "A sincronizar…" : "Sincronizar agora"}
      </button>
      {/* Backfill único: traz todas as reservas de 2026. */}
      <button
        type="submit"
        name="desde"
        value="2026-01-01"
        className="al-back"
        style={{ padding: "9px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
        disabled={pending}
      >
        Importar histórico 2026
      </button>
      {state.mensagem && (
        <span className="al-pos" style={{ fontSize: 13 }}>
          {state.mensagem}
        </span>
      )}
      {state.error && (
        <span className="al-num al-neg" style={{ fontSize: 13 }}>
          {state.error}
        </span>
      )}
    </form>
  );
}

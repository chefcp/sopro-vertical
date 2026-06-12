"use client";

import { useState, useRef, useEffect } from "react";

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 14,
  background: "var(--paper)",
  color: "var(--ink)",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--muted)",
  display: "block",
  marginBottom: 6,
};

/**
 * Botão que abre um painel flutuante com um formulário de ação.
 * Fecha ao clicar fora.
 */
export function AccaoPanel({
  label,
  children,
}: {
  label: string;
  children: (fechar: () => void) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [aberto]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="al-btn"
        onClick={() => setAberto((v) => !v)}
      >
        {label}
      </button>
      {aberto && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 20,
            width: 280,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "0 8px 28px rgba(24,34,46,0.12)",
            padding: 16,
          }}
        >
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  );
}

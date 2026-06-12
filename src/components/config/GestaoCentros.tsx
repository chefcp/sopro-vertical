"use client";

import { useActionState } from "react";
import {
  criarCentroCustoAction,
  atualizarCentroCustoAction,
  type ConfigState,
} from "@/lib/actions/config";
import { inputStyle, labelStyle } from "@/components/AccaoPanel";

type CC = {
  id: string;
  nome: string;
  gera_faturacao: boolean;
  ordem: number;
};

export function GestaoCentros({ centros }: { centros: CC[] }) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(
    criarCentroCustoAction,
    {},
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 8 }}>
        {centros.map((cc) => (
          <LinhaCentro key={cc.id} cc={cc} />
        ))}
      </div>

      <form
        action={action}
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 90px auto auto",
          gap: 8,
          alignItems: "end",
          borderTop: "1px solid var(--line)",
          paddingTop: 12,
        }}
      >
        <div>
          <label style={labelStyle}>Novo centro de custo</label>
          <input name="nome" placeholder="Nome" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Ordem</label>
          <input name="ordem" type="number" defaultValue={100} style={inputStyle} />
        </div>
        <label
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, paddingBottom: 8 }}
        >
          <input type="checkbox" name="gera_faturacao" defaultChecked />
          Fatura
        </label>
        <button type="submit" className="al-btn" disabled={pending}>
          {pending ? "…" : "Criar"}
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

function LinhaCentro({ cc }: { cc: CC }) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(
    atualizarCentroCustoAction,
    {},
  );

  return (
    <form
      action={action}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 90px auto auto",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input type="hidden" name="id" value={cc.id} />
      <input name="nome" defaultValue={cc.nome} style={inputStyle} />
      <input
        name="ordem"
        type="number"
        defaultValue={Number(cc.ordem)}
        style={inputStyle}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          name="gera_faturacao"
          defaultChecked={cc.gera_faturacao}
        />
        Fatura
      </label>
      <button
        type="submit"
        className="al-back"
        style={{ padding: 0 }}
        disabled={pending}
        title={state.mensagem ?? "Guardar"}
      >
        {pending ? "…" : "Guardar"}
      </button>
    </form>
  );
}

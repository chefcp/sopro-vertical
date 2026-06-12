"use client";

import { useActionState, useState } from "react";
import {
  criarCasaAction,
  atualizarCasaAction,
  type CasaState,
} from "@/lib/actions/casas";
import { inputStyle, labelStyle } from "./AccaoPanel";

type CC = { id: string; nome: string };

export function FormularioCasa({
  centros,
  modo,
  casaId,
  inicial,
}: {
  centros: CC[];
  modo: "criar" | "editar";
  casaId?: string;
  inicial?: {
    nome: string;
    morada: string;
    centro_custo_id: string;
    peso_base: string;
    iva_percentagem: string;
  };
}) {
  const [v, setV] = useState({
    nome: inicial?.nome ?? "",
    morada: inicial?.morada ?? "",
    centro_custo_id: inicial?.centro_custo_id ?? "",
    peso_base: inicial?.peso_base ?? "0",
    iva_percentagem: inicial?.iva_percentagem ?? "0",
  });
  const [state, action, pending] = useActionState<CasaState, FormData>(
    modo === "criar" ? criarCasaAction : atualizarCasaAction,
    {},
  );

  const set = (campo: keyof typeof v, valor: string) =>
    setV((p) => ({ ...p, [campo]: valor }));

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {modo === "editar" && casaId && (
        <input type="hidden" name="id" value={casaId} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="nome">
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            style={inputStyle}
            value={v.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="peso_base">
            Peso de repartição (%)
          </label>
          <input
            id="peso_base"
            name="peso_base"
            type="number"
            step="0.01"
            min="0"
            style={inputStyle}
            value={v.peso_base}
            onChange={(e) => set("peso_base", e.target.value)}
          />
        </div>
      </div>
      <div style={{ maxWidth: 220 }}>
        <label style={labelStyle} htmlFor="iva_percentagem">
          IVA da casa (%)
        </label>
        <input
          id="iva_percentagem"
          name="iva_percentagem"
          type="number"
          step="0.01"
          min="0"
          max="100"
          style={inputStyle}
          value={v.iva_percentagem}
          onChange={(e) => set("iva_percentagem", e.target.value)}
        />
        <span className="al-hint" style={{ fontSize: 12 }}>
          Pré-preenche o IVA das reservas desta casa (IVA incluído no preço).
        </span>
      </div>
      <div>
        <label style={labelStyle} htmlFor="morada">
          Morada (opcional)
        </label>
        <input
          id="morada"
          name="morada"
          style={inputStyle}
          value={v.morada}
          onChange={(e) => set("morada", e.target.value)}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="centro_custo_id">
          Centro de custo
        </label>
        <select
          id="centro_custo_id"
          name="centro_custo_id"
          style={inputStyle}
          value={v.centro_custo_id}
          onChange={(e) => set("centro_custo_id", e.target.value)}
        >
          <option value="" disabled>
            Escolhe…
          </option>
          {centros.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 13, margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" className="al-btn" disabled={pending}>
        {pending ? "A guardar…" : modo === "criar" ? "Criar casa" : "Guardar"}
      </button>
      <p className="al-hint" style={{ margin: 0 }}>
        O peso serve para repartir custos gerais do CC pelas casas
        automaticamente.
      </p>
    </form>
  );
}

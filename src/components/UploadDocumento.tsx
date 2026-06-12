"use client";

import { useActionState, useState } from "react";
import { uploadDocumentoAction, type DocState } from "@/lib/actions/documentos";
import { inputStyle, labelStyle } from "./AccaoPanel";

type Opcao = { id: string; label: string };

export function UploadDocumento({
  reservas,
  custos,
}: {
  reservas: Opcao[];
  custos: Opcao[];
}) {
  const [tipo, setTipo] = useState<"reserva" | "custo">("custo");
  const [state, action, pending] = useActionState<DocState, FormData>(
    uploadDocumentoAction,
    {},
  );

  const opcoes = tipo === "reserva" ? reservas : custos;

  return (
    <div className="al-card" style={{ padding: 20, marginBottom: 22 }}>
      <form action={action} style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: 12,
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="entidade_tipo">
              Tipo
            </label>
            <select
              id="entidade_tipo"
              name="entidade_tipo"
              style={inputStyle}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "reserva" | "custo")}
            >
              <option value="custo">Custo</option>
              <option value="reserva">Reserva</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="entidade_id">
              {tipo === "reserva" ? "Reserva" : "Custo"}
            </label>
            <select
              id="entidade_id"
              name="entidade_id"
              style={inputStyle}
              defaultValue=""
              key={tipo}
            >
              <option value="" disabled>
                Escolhe…
              </option>
              {opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle} htmlFor="ficheiro">
            Ficheiro — PDF, PNG, JPEG ou WEBP (máx. 10 MB)
          </label>
          <input
            id="ficheiro"
            name="ficheiro"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            style={inputStyle}
          />
        </div>

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
          {pending ? "A carregar…" : "Carregar documento"}
        </button>
      </form>
    </div>
  );
}

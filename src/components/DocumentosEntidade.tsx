"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  uploadDocumentoAction,
  apagarDocumentoAction,
  type DocState,
} from "@/lib/actions/documentos";
import { inputStyle } from "./AccaoPanel";

type Doc = {
  id: string;
  nome_ficheiro: string | null;
  storage_path: string;
  url: string | null;
};

export function DocumentosEntidade({
  entidadeTipo,
  entidadeId,
  docs,
}: {
  entidadeTipo: "reserva" | "custo";
  entidadeId: string;
  docs: Doc[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DocState, FormData>(
    uploadDocumentoAction,
    {},
  );

  useEffect(() => {
    if (state.mensagem) router.refresh();
  }, [state.mensagem, router]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {docs.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {docs.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                borderBottom: "1px solid var(--line)",
                paddingBottom: 6,
              }}
            >
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, color: "var(--iva)", textDecoration: "none" }}
                >
                  {d.nome_ficheiro ?? "documento"}
                </a>
              ) : (
                <span style={{ flex: 1 }}>{d.nome_ficheiro ?? "documento"}</span>
              )}
              <form action={apagarDocumentoAction}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="path" value={d.storage_path} />
                <button type="submit" className="al-back" style={{ padding: 0 }}>
                  apagar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="entidade_tipo" value={entidadeTipo} />
        <input type="hidden" name="entidade_id" value={entidadeId} />
        <input
          name="ficheiro"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <button type="submit" className="al-btn" disabled={pending}>
          {pending ? "A carregar…" : "Anexar"}
        </button>
      </form>
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
      <p className="al-hint" style={{ margin: 0 }}>
        PDF, PNG, JPEG ou WEBP (máx. 10 MB). Acesso por ligação temporária.
      </p>
    </div>
  );
}

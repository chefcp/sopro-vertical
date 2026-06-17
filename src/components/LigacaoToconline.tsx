"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ligarToconlineAction,
  desligarToconlineAction,
  type ToconlineState,
} from "@/lib/actions/toconline";

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "var(--surface)",
  color: "var(--ink)",
  width: "100%",
};

export function LigacaoToconline({
  configurado,
  ligado,
  ligadoEm,
  urlAutorizacao,
}: {
  configurado: boolean;
  ligado: boolean;
  ligadoEm: string | null;
  urlAutorizacao: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ToconlineState, FormData>(
    ligarToconlineAction,
    {},
  );
  const [aDesligar, startDesligar] = useTransition();

  if (!configurado) {
    return (
      <p className="al-hint" style={{ margin: 0 }}>
        Faltam as credenciais do TOConline no servidor (<code>.env.local</code>):
        CLIENT_ID, CLIENT_SECRET, OAUTH_URL, API_URL e REDIRECT_URL.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 14 }}>
        Estado:{" "}
        {ligado ? (
          <span className="al-chip al-chip-ok">✓ ligado</span>
        ) : (
          <span className="al-chip al-chip-no">não ligado</span>
        )}
        {ligado && ligadoEm && (
          <span className="al-hint" style={{ marginLeft: 8 }}>
            desde {new Date(ligadoEm).toLocaleString("pt-PT")}
          </span>
        )}
      </p>

      <ol className="al-hint" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
        <li>
          <a href={urlAutorizacao} target="_blank" rel="noopener noreferrer">
            Abrir a autorização do TOConline →
          </a>{" "}
          e autoriza o acesso.
        </li>
        <li>
          Vais parar a uma página que mostra um <strong>código</strong> (após{" "}
          <code>?code=</code>). Copia-o.
        </li>
        <li>Cola o código aqui em baixo e carrega em <strong>Ligar</strong>.</li>
      </ol>

      <form action={action} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          name="code"
          placeholder="Cola aqui o código de autorização"
          style={inputStyle}
        />
        <button type="submit" className="al-btn" disabled={pending}>
          {pending ? "A ligar…" : ligado ? "Religar" : "Ligar"}
        </button>
      </form>

      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
      {state.mensagem && (
        <p className="al-num al-pos" style={{ fontSize: 12.5, margin: 0 }}>
          {state.mensagem}
        </p>
      )}

      {ligado && (
        <button
          type="button"
          className="al-back"
          style={{ padding: 0, color: "var(--neg)", justifySelf: "start" }}
          disabled={aDesligar}
          onClick={() =>
            startDesligar(async () => {
              await desligarToconlineAction();
              router.refresh();
            })
          }
        >
          Desligar do TOConline
        </button>
      )}

      <p className="al-hint" style={{ margin: 0 }}>
        Os tokens do TOConline expiram com frequência (~8 h). Se a puxada disser
        que o token expirou, é só repetir estes passos.
      </p>
    </div>
  );
}

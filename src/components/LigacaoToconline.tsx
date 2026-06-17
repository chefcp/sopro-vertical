"use client";

import { useActionState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const toc = searchParams.get("toc");
  const TOC_MSG: Record<string, { texto: string; ok: boolean }> = {
    ok: { texto: "Ligado ao TOConline.", ok: true },
    erro: { texto: "Falha ao ligar — tenta de novo.", ok: false },
    sem_codigo: { texto: "O TOConline não devolveu código.", ok: false },
    sem_config: { texto: "TOConline não configurado no servidor.", ok: false },
  };
  const tocBanner = toc ? TOC_MSG[toc] : null;
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

      {tocBanner && (
        <p
          className={`al-num ${tocBanner.ok ? "al-pos" : "al-neg"}`}
          style={{ fontSize: 12.5, margin: 0 }}
        >
          {tocBanner.texto}
        </p>
      )}

      <a href={urlAutorizacao} className="al-btn" style={{ justifySelf: "start" }}>
        {ligado ? "Religar ao TOConline" : "Ligar ao TOConline"}
      </a>
      <p className="al-hint" style={{ margin: 0 }}>
        Abre a autorização do TOConline; depois de autorizares, voltas aqui
        automaticamente já ligado.
      </p>

      <details>
        <summary className="al-hint" style={{ cursor: "pointer" }}>
          Não voltou sozinho? Colar o código à mão
        </summary>
        <form
          action={action}
          style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}
        >
          <input
            name="code"
            placeholder="Cola aqui o código (após ?code=)"
            style={inputStyle}
          />
          <button type="submit" className="al-btn" disabled={pending}>
            {pending ? "A ligar…" : "Ligar"}
          </button>
        </form>
      </details>

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

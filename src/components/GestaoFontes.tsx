"use client";

import { useActionState, useState } from "react";
import {
  criarFonteAction,
  removerFonteAction,
  alternarFonteAction,
  type FonteState,
} from "@/lib/actions/fontes";
import { listarPropriedadesLodgify } from "@/lib/actions/sync";
import { inputStyle, labelStyle } from "./AccaoPanel";
import { FONTE_TIPO_LABEL, FONTE_TIPOS_OPCOES } from "@/lib/canais";

type Fonte = {
  id: string;
  tipo: string;
  referencia: string;
  ativo: boolean;
};

type Propriedade = { id: string; nome: string };

export function GestaoFontes({
  casaId,
  fontes,
}: {
  casaId: string;
  fontes: Fonte[];
}) {
  const [state, action, pending] = useActionState<FonteState, FormData>(
    criarFonteAction,
    {},
  );
  const [tipo, setTipo] = useState("");
  const [props, setProps] = useState<Propriedade[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [propsErro, setPropsErro] = useState<string | null>(null);

  const propLabel = new Map<string, string>();
  props?.forEach((p) => propLabel.set(p.id, p.nome));

  async function onTipoChange(novo: string) {
    setTipo(novo);
    if (novo === "lodgify_api" && props === null && !carregando) {
      setCarregando(true);
      setPropsErro(null);
      const res = await listarPropriedadesLodgify();
      if (res.error) setPropsErro(res.error);
      else setProps(res.propriedades ?? []);
      setCarregando(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 8 }}>
        {fontes.map((f) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              borderBottom: "1px solid var(--line)",
              paddingBottom: 8,
              opacity: f.ativo ? 1 : 0.5,
            }}
          >
            <span className="al-tag" style={{ marginLeft: 0 }}>
              {FONTE_TIPO_LABEL[f.tipo] ?? f.tipo}
            </span>
            <span
              className="al-mono"
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={f.referencia}
            >
              {f.tipo === "lodgify_api"
                ? `Propriedade ${f.referencia}`
                : f.referencia}
            </span>
            <form action={alternarFonteAction}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="casa_id" value={casaId} />
              <input type="hidden" name="ativo" value={String(f.ativo)} />
              <button type="submit" className="al-back" style={{ padding: 0 }}>
                {f.ativo ? "desativar" : "ativar"}
              </button>
            </form>
            <form action={removerFonteAction}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="casa_id" value={casaId} />
              <button type="submit" className="al-back" style={{ padding: 0 }} title="Remover">
                ✕
              </button>
            </form>
          </div>
        ))}
        {fontes.length === 0 && (
          <p className="al-hint" style={{ margin: 0 }}>
            Sem fontes. Adiciona a iCal do Airbnb/VRBO ou escolhe a propriedade
            no Lodgify.
          </p>
        )}
      </div>

      <form
        action={action}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr auto",
          gap: 8,
          alignItems: "end",
          borderTop: "1px solid var(--line)",
          paddingTop: 12,
        }}
      >
        <input type="hidden" name="casa_id" value={casaId} />
        <div>
          <label style={labelStyle}>Tipo</label>
          <select
            name="tipo"
            style={inputStyle}
            value={tipo}
            onChange={(e) => onTipoChange(e.target.value)}
          >
            <option value="" disabled>
              Tipo…
            </option>
            {FONTE_TIPOS_OPCOES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            {tipo === "lodgify_api" ? "Propriedade no Lodgify" : "URL iCal"}
          </label>
          {tipo === "lodgify_api" ? (
            carregando ? (
              <div style={{ ...inputStyle, color: "var(--muted)" }}>
                A carregar propriedades…
              </div>
            ) : props && props.length > 0 ? (
              <select name="referencia" style={inputStyle} defaultValue="">
                <option value="" disabled>
                  Escolhe a propriedade…
                </option>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="referencia"
                placeholder="id da propriedade"
                style={inputStyle}
              />
            )
          ) : (
            <input
              name="referencia"
              type="url"
              placeholder="https://…/calendar.ics"
              style={inputStyle}
            />
          )}
        </div>
        <button type="submit" className="al-btn" disabled={pending || carregando}>
          {pending ? "…" : "Adicionar"}
        </button>
      </form>

      {propsErro && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          Lodgify: {propsErro}
        </p>
      )}
      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
      <p className="al-hint" style={{ margin: 0 }}>
        Cada casa deve ter UMA fonte principal. Se a casa está no Lodgify, usa só
        a fonte Lodgify (já inclui o Airbnb dela).
      </p>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import {
  criarCustoAction,
  atualizarCustoAction,
  type CustoState,
} from "@/lib/actions/custos";
import { inputStyle, labelStyle } from "./AccaoPanel";

type CC = { id: string; nome: string };
type Casa = { id: string; nome: string; centro_custo_id: string };

export type LinhaAloc = {
  centro_custo_id: string;
  casa_id: string;
  percentagem: string;
};

export type ValoresCusto = {
  fornecedor: string;
  nif: string;
  atcud: string;
  descricao: string;
  data: string;
  data_pagamento: string;
  valor_base: string;
  iva: string;
  taxa_plataforma: boolean;
  pago_por_cc_id: string;
  alocacoes: LinhaAloc[];
};

const linhaVazia = (): LinhaAloc => ({
  centro_custo_id: "",
  casa_id: "",
  percentagem: "",
});

export function FormularioCusto({
  centros,
  casas,
  modo,
  custoId,
  inicial,
  nomesPorNif = {},
}: {
  centros: CC[];
  casas: Casa[];
  modo: "criar" | "editar";
  custoId?: string;
  inicial?: ValoresCusto;
  nomesPorNif?: Record<string, string>;
}) {
  const [nif, setNif] = useState(inicial?.nif ?? "");
  const [fornecedor, setFornecedor] = useState(inicial?.fornecedor ?? "");
  const geralId =
    centros.find((c) => c.nome.toLowerCase() === "geral")?.id ?? "";
  const [taxaPlataforma, setTaxaPlataforma] = useState(
    inicial?.taxa_plataforma ?? false,
  );
  const [pagoPorCc, setPagoPorCc] = useState(
    inicial?.pago_por_cc_id || geralId,
  );
  const [dataFatura, setDataFatura] = useState(inicial?.data ?? "");
  const [dataPagamento, setDataPagamento] = useState(
    inicial?.data_pagamento ?? inicial?.data ?? "",
  );
  // A data de pagamento acompanha a da fatura enquanto não for tocada.
  const onData = (v: string) =>
    setDataFatura((prev) => {
      setDataPagamento((dp) => (dp === "" || dp === prev ? v : dp));
      return v;
    });

  // Ao sair do NIF, se for conhecido de faturas anteriores, preenche o nome.
  const aoSairNif = () => {
    const nome = nomesPorNif[nif.trim()];
    if (nome && !fornecedor.trim()) setFornecedor(nome);
  };
  const [linhas, setLinhas] = useState<LinhaAloc[]>(
    inicial?.alocacoes && inicial.alocacoes.length > 0
      ? inicial.alocacoes
      : [linhaVazia()],
  );
  const [state, action, pending] = useActionState<CustoState, FormData>(
    modo === "criar" ? criarCustoAction : atualizarCustoAction,
    {},
  );

  const soma = linhas.reduce((s, l) => s + (Number(l.percentagem) || 0), 0);

  const atualizar = (i: number, campo: keyof LinhaAloc, valor: string) => {
    setLinhas((ls) =>
      ls.map((l, j) =>
        j === i
          ? {
              ...l,
              [campo]: valor,
              ...(campo === "centro_custo_id" ? { casa_id: "" } : {}),
            }
          : l,
      ),
    );
  };

  const alocacoesJson = JSON.stringify(
    linhas
      .filter((l) => l.centro_custo_id && Number(l.percentagem) > 0)
      .map((l) => ({
        centro_custo_id: l.centro_custo_id,
        casa_id: l.casa_id || null,
        percentagem: Number(l.percentagem),
      })),
  );

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <input type="hidden" name="alocacoes" value={alocacoesJson} />
      {modo === "editar" && custoId && (
        <input type="hidden" name="id" value={custoId} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="nif">
            NIF do fornecedor
          </label>
          <input
            id="nif"
            name="nif"
            inputMode="numeric"
            placeholder="ex.: 510698905"
            style={inputStyle}
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            onBlur={aoSairNif}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="fornecedor">
            Fornecedor
          </label>
          <input
            id="fornecedor"
            name="fornecedor"
            style={inputStyle}
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="data">
            Data
          </label>
          <input
            id="data"
            name="data"
            type="date"
            style={inputStyle}
            value={dataFatura}
            onChange={(e) => onData(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="descricao">
            Descrição (opcional)
          </label>
          <input
            id="descricao"
            name="descricao"
            style={inputStyle}
            defaultValue={inicial?.descricao ?? ""}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="atcud">
            ATCUD / código
          </label>
          <input
            id="atcud"
            name="atcud"
            placeholder="código do documento"
            style={inputStyle}
            defaultValue={inicial?.atcud ?? ""}
          />
          <span className="al-hint" style={{ fontSize: 12 }}>
            deteta faturas repetidas; estrangeiras = código tal como está
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="valor_base">
            Valor base (€)
          </label>
          <input
            id="valor_base"
            name="valor_base"
            type="number"
            step="0.01"
            min="0"
            defaultValue={inicial?.valor_base ?? "0"}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="iva">
            IVA (€)
          </label>
          <input
            id="iva"
            name="iva"
            type="number"
            step="0.01"
            min="0"
            defaultValue={inicial?.iva ?? "0"}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            name="taxa_plataforma"
            checked={taxaPlataforma}
            onChange={(e) => setTaxaPlataforma(e.target.checked)}
          />
          Taxa de plataforma (Airbnb/VRBO/Stripe) — só Resultado e IVA, sem pagamento
        </label>
        {!taxaPlataforma && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="pago_por_cc_id">
                Pago por (centro de custo)
              </label>
              <select
                id="pago_por_cc_id"
                name="pago_por_cc_id"
                style={inputStyle}
                value={pagoPorCc}
                onChange={(e) => setPagoPorCc(e.target.value)}
              >
                <option value="" disabled>
                  Escolhe…
                </option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.id === geralId ? " (Sopro)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="data_pagamento">
                Data de pagamento
              </label>
              <input
                id="data_pagamento"
                name="data_pagamento"
                type="date"
                style={inputStyle}
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
              <span className="al-hint" style={{ fontSize: 12 }}>
                vazio = ainda não pago
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <span style={labelStyle}>Alocações por centro de custo / casa</span>
          <span
            className={`al-num ${
              Math.abs(soma - 100) < 0.01 ? "al-pos" : "al-neg"
            }`}
            style={{ fontSize: 13 }}
          >
            {soma}% / 100%
          </span>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {linhas.map((l, i) => {
            const casasDoCc = casas.filter(
              (c) => c.centro_custo_id === l.centro_custo_id,
            );
            return (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 90px 32px",
                  gap: 8,
                }}
              >
                <select
                  style={inputStyle}
                  value={l.centro_custo_id}
                  onChange={(e) => atualizar(i, "centro_custo_id", e.target.value)}
                >
                  <option value="">Centro de custo…</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <select
                  style={inputStyle}
                  value={l.casa_id}
                  onChange={(e) => atualizar(i, "casa_id", e.target.value)}
                  disabled={!l.centro_custo_id || casasDoCc.length === 0}
                >
                  <option value="">Todo o CC</option>
                  {casasDoCc.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="%"
                  style={{ ...inputStyle, textAlign: "right" }}
                  value={l.percentagem}
                  onChange={(e) => atualizar(i, "percentagem", e.target.value)}
                />
                <button
                  type="button"
                  className="al-back"
                  style={{ padding: 0 }}
                  onClick={() =>
                    setLinhas((ls) =>
                      ls.length === 1
                        ? [linhaVazia()]
                        : ls.filter((_, j) => j !== i),
                    )
                  }
                  title="Remover linha"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="al-back"
          style={{ padding: "8px 0 0" }}
          onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
        >
          + Adicionar alocação
        </button>
      </div>

      {state.error && (
        <p className="al-num al-neg" style={{ fontSize: 13, margin: 0 }}>
          {state.error}
        </p>
      )}

      <button type="submit" className="al-btn" disabled={pending}>
        {pending
          ? "A guardar…"
          : modo === "criar"
            ? "Registar e lançar"
            : "Guardar e relançar"}
      </button>
      <p className="al-hint" style={{ margin: 0 }}>
        Resultado (s/ IVA) e IVA entram na data da fatura. O pagamento (pelo CC
        escolhido — o Geral representa a Sopro) entra na data de pagamento:
        Suprimentos + e Tesouraria + no pagador, Tesouraria − no CC do custo.
        Taxas de plataforma não têm pagamento (já vêm descontadas no recebimento).
      </p>
    </form>
  );
}

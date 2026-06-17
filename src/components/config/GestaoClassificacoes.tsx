"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  guardarClassificacaoFornecedorAction,
  apagarClassificacaoFornecedorAction,
  type ClassificacaoFornecedor,
} from "@/lib/actions/classificacoes";

type CC = { id: string; nome: string };
type Casa = { id: string; nome: string; centro_custo_id: string };

const sel: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "var(--surface)",
  color: "var(--ink)",
};

export function GestaoClassificacoes({
  classificacoes,
  nomesPorNif,
  centros,
  casas,
}: {
  classificacoes: ClassificacaoFornecedor[];
  nomesPorNif: Record<string, string>;
  centros: CC[];
  casas: Casa[];
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<ClassificacaoFornecedor[]>(classificacoes);
  const [aProcessar, start] = useTransition();

  const patch = (nif: string, p: Partial<ClassificacaoFornecedor>) =>
    setLinhas((prev) => prev.map((l) => (l.nif === nif ? { ...l, ...p } : l)));

  const guardar = (l: ClassificacaoFornecedor) =>
    start(async () => {
      await guardarClassificacaoFornecedorAction(l);
      router.refresh();
    });
  const apagar = (nif: string) =>
    start(async () => {
      await apagarClassificacaoFornecedorAction(nif);
      setLinhas((prev) => prev.filter((l) => l.nif !== nif));
      router.refresh();
    });

  const casasDoCc = (ccId: string | null) =>
    casas.filter((c) => c.centro_custo_id === ccId);

  if (linhas.length === 0) {
    return (
      <p className="al-hint" style={{ margin: 0 }}>
        Ainda não há fornecedores memorizados. Ao importar custos, carrega no 📌
        de uma linha para guardar o centro de custo, casa, quem paga e se é taxa
        de plataforma desse fornecedor — as próximas importações ficam
        pré-preenchidas.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="al-table" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th>Fornecedor (NIF)</th>
            <th>Centro de custo</th>
            <th>Casa</th>
            <th>Pago por</th>
            <th className="al-c">Taxa plat.</th>
            <th style={{ width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nif}>
              <td>
                {nomesPorNif[l.nif] ?? "—"}
                <span className="al-hint" style={{ display: "block", margin: 0 }}>
                  {l.nif}
                </span>
              </td>
              <td>
                <select
                  value={l.centro_custo_id ?? ""}
                  onChange={(e) =>
                    patch(l.nif, {
                      centro_custo_id: e.target.value || null,
                      casa_id: null,
                    })
                  }
                  style={sel}
                >
                  <option value="">—</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={l.casa_id ?? ""}
                  onChange={(e) => patch(l.nif, { casa_id: e.target.value || null })}
                  style={sel}
                  disabled={!l.centro_custo_id}
                >
                  <option value="">— todas —</option>
                  {casasDoCc(l.centro_custo_id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={l.pago_por_cc_id ?? ""}
                  onChange={(e) =>
                    patch(l.nif, { pago_por_cc_id: e.target.value || null })
                  }
                  style={sel}
                >
                  <option value="">Geral (Sopro)</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </td>
              <td className="al-c">
                <input
                  type="checkbox"
                  checked={l.taxa_plataforma}
                  onChange={(e) => patch(l.nif, { taxa_plataforma: e.target.checked })}
                />
              </td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="al-btn"
                    onClick={() => guardar(l)}
                    disabled={aProcessar}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="al-back"
                    style={{ padding: 0, color: "var(--neg)" }}
                    onClick={() => apagar(l.nif)}
                    disabled={aProcessar}
                  >
                    Esquecer
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lerQrDeFicheiro } from "@/lib/fatura-scan";
import { parseFaturaQr } from "@/lib/fatura-qr";
import {
  importarCustosAction,
  type CustoImportado,
  type ImportarResultado,
} from "@/lib/actions/importar-custos";
import type { PagoPorTipo } from "@/lib/types";

type Centro = { id: string; nome: string };
type Casa = { id: string; nome: string; centro_custo_id: string };

type Rascunho = {
  cid: string;
  nif: string;
  nifAdquirente: string;
  atcud: string;
  fornecedor: string;
  descricao: string;
  data: string;
  valor_base: string;
  iva: string;
  centro_custo_id: string;
  casa_id: string;
  pago_por_tipo: PagoPorTipo;
  pago_por_cc_id: string;
  file: File | null;
  ficheiro: string | null;
  aviso?: string;
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "var(--surface)",
  color: "var(--ink)",
  width: "100%",
};

function nomeSeguro(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function normalizarData(s: string): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

function parseValor(s: string): string {
  let t = s.replace(/[€\s]/g, "");
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "";
}

const COLUNAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function ImportadorFaturas({
  centros,
  casas,
  orgId,
  orgNif,
  nomesPorNif,
}: {
  centros: Centro[];
  casas: Casa[];
  orgId: string;
  orgNif: string | null;
  nomesPorNif: Record<string, string>;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"qr" | "excel">("qr");
  const [linhas, setLinhas] = useState<Rascunho[]>([]);
  const [processando, setProcessando] = useState(false);
  const [aGuardar, startGuardar] = useTransition();
  const [resultado, setResultado] = useState<ImportarResultado | null>(null);

  // Classificação em bulk.
  const [bCc, setBCc] = useState("");
  const [bCasa, setBCasa] = useState("");
  const [bPagoTipo, setBPagoTipo] = useState<PagoPorTipo>("sopro");
  const [bPagoCc, setBPagoCc] = useState("");

  // Excel.
  const [excelRows, setExcelRows] = useState<string[][]>([]);
  const [cabecalho, setCabecalho] = useState(true);
  const [colForn, setColForn] = useState(0);
  const [colData, setColData] = useState(1);
  const [colBase, setColBase] = useState(2);
  const [colIva, setColIva] = useState(3);
  const [colCc, setColCc] = useState(-1);

  const novaLinha = (p: Partial<Rascunho>): Rascunho => ({
    cid: crypto.randomUUID(),
    nif: "",
    nifAdquirente: "",
    atcud: "",
    fornecedor: "",
    descricao: "",
    data: "",
    valor_base: "",
    iva: "",
    centro_custo_id: bCc,
    casa_id: bCasa,
    pago_por_tipo: bPagoTipo,
    pago_por_cc_id: bPagoCc,
    file: null,
    ficheiro: null,
    ...p,
  });

  const setLinha = (cid: string, patch: Partial<Rascunho>) =>
    setLinhas((prev) => prev.map((l) => (l.cid === cid ? { ...l, ...patch } : l)));
  const removerLinha = (cid: string) =>
    setLinhas((prev) => prev.filter((l) => l.cid !== cid));

  async function adicionarQr(files: FileList | null) {
    if (!files?.length) return;
    setProcessando(true);
    setResultado(null);
    const novas: Rascunho[] = [];
    for (const file of Array.from(files)) {
      const texto = await lerQrDeFicheiro(file);
      const q = texto ? parseFaturaQr(texto) : null;
      if (q) {
        novas.push(
          novaLinha({
            nif: q.nif,
            nifAdquirente: q.nifAdquirente,
            atcud: q.atcud,
            fornecedor: nomesPorNif[q.nif] ?? "",
            descricao: [q.tipoDoc, q.numero].filter(Boolean).join(" "),
            data: q.data ?? "",
            valor_base: String(q.valorBase),
            iva: String(q.iva),
            file,
            ficheiro: file.name,
          }),
        );
      } else {
        novas.push(
          novaLinha({
            file,
            ficheiro: file.name,
            aviso: "QR ilegível — preenche à mão",
          }),
        );
      }
    }
    setLinhas((prev) => [...prev, ...novas]);
    setProcessando(false);
  }

  async function descarregarModelo() {
    const XLSX = await import("xlsx");
    const aoa = [
      ["Fornecedor", "Data (AAAA-MM-DD)", "Base", "IVA", "Centro de custo"],
      ["EDP Comercial", "2026-05-12", "71.14", "16.36", "Pico"],
      ["Galp Energia", "2026-05-09", "40.65", "9.35", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custos");
    XLSX.writeFile(wb, "modelo-custos-sopro.xlsx");
  }

  async function carregarExcel(file: File | null) {
    if (!file) return;
    setResultado(null);
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    setExcelRows(rows.map((r) => r.map((c) => String(c ?? ""))));
  }

  function gerarDeExcel() {
    const rows = cabecalho ? excelRows.slice(1) : excelRows;
    const novas = rows
      .filter((r) => r.some((c) => c.trim() !== ""))
      .map((r) => {
        const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
        const ccNome = get(colCc).toLowerCase();
        const ccMatch = centros.find((c) => c.nome.toLowerCase() === ccNome);
        return novaLinha({
          fornecedor: get(colForn),
          data: normalizarData(get(colData)),
          valor_base: parseValor(get(colBase)),
          iva: parseValor(get(colIva)),
          centro_custo_id: ccMatch?.id ?? bCc,
        });
      });
    setLinhas((prev) => [...prev, ...novas]);
    setExcelRows([]);
  }

  function aplicarATodas() {
    setLinhas((prev) =>
      prev.map((l) => ({
        ...l,
        centro_custo_id: bCc || l.centro_custo_id,
        casa_id: bCasa,
        pago_por_tipo: bPagoTipo,
        pago_por_cc_id: bPagoTipo === "cc" ? bPagoCc : "",
      })),
    );
  }

  const linhaValida = (l: Rascunho) =>
    !!l.fornecedor.trim() &&
    !!l.data &&
    !!l.centro_custo_id &&
    (l.pago_por_tipo === "sopro" || !!l.pago_por_cc_id) &&
    Number.isFinite(Number(l.valor_base)) &&
    Number.isFinite(Number(l.iva));

  const validas = useMemo(() => linhas.filter(linhaValida), [linhas]);

  // ATCUDs que aparecem mais do que uma vez neste lote.
  const atcudsRepetidos = useMemo(() => {
    const cont: Record<string, number> = {};
    for (const l of linhas) if (l.atcud) cont[l.atcud] = (cont[l.atcud] ?? 0) + 1;
    return new Set(
      Object.entries(cont)
        .filter(([, n]) => n > 1)
        .map(([k]) => k),
    );
  }, [linhas]);

  const avisosDe = (l: Rascunho): string[] => {
    const a: string[] = [];
    if (l.aviso) a.push(l.aviso);
    if (l.nifAdquirente && orgNif && l.nifAdquirente !== orgNif) {
      a.push(`Adquirente ${l.nifAdquirente} ≠ NIF da Sopro (${orgNif})`);
    }
    if (l.atcud && atcudsRepetidos.has(l.atcud)) {
      a.push("ATCUD repetido neste lote");
    }
    return a;
  };
  const totalImportar = validas.reduce(
    (s, l) => s + Number(l.valor_base || 0) + Number(l.iva || 0),
    0,
  );

  function guardar() {
    if (!validas.length) {
      setResultado({ ok: 0, duplicadas: 0, erros: ["Nada válido para gravar."] });
      return;
    }
    startGuardar(async () => {
      const supabase = createClient();
      const payload: CustoImportado[] = [];
      const cidsEnviados: string[] = [];

      for (let i = 0; i < validas.length; i++) {
        const l = validas[i];
        let storage_path: string | null = null;
        if (l.file) {
          const path = `${orgId}/custo/${Date.now()}-${i}-${nomeSeguro(
            l.file.name,
          )}`;
          const { error } = await supabase.storage
            .from("documentos")
            .upload(path, l.file, {
              contentType: l.file.type || "application/octet-stream",
              upsert: false,
            });
          if (!error) storage_path = path;
        }
        payload.push({
          fornecedor: l.fornecedor.trim(),
          descricao: l.descricao.trim() || null,
          data: l.data,
          valor_base: Number(l.valor_base || 0),
          iva: Number(l.iva || 0),
          centro_custo_id: l.centro_custo_id,
          casa_id: l.casa_id || null,
          pago_por_tipo: l.pago_por_tipo,
          pago_por_cc_id: l.pago_por_tipo === "cc" ? l.pago_por_cc_id : null,
          nif: l.nif || null,
          atcud: l.atcud || null,
          storage_path,
          nome_ficheiro: l.ficheiro,
        });
        cidsEnviados.push(l.cid);
      }

      const res = await importarCustosAction(payload);
      // Tira da tabela as que foram enviadas (evita duplicar ao gravar de novo).
      setLinhas((prev) => prev.filter((l) => !cidsEnviados.includes(l.cid)));
      setResultado(res);
      router.refresh();
    });
  }

  const casasDoCc = (ccId: string) => casas.filter((c) => c.centro_custo_id === ccId);

  return (
    <div>
      <div
        className="al-tabs"
        style={{ padding: 0, marginBottom: 16, border: "none" }}
      >
        <button
          type="button"
          className={`al-tab ${modo === "qr" ? "on" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => setModo("qr")}
        >
          Por QR-Code
        </button>
        <button
          type="button"
          className={`al-tab ${modo === "excel" ? "on" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => setModo("excel")}
        >
          Por Excel/CSV
        </button>
      </div>

      {modo === "qr" ? (
        <label
          className="al-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 16,
            marginBottom: 16,
            cursor: "pointer",
            borderStyle: "dashed",
          }}
        >
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => {
              adicionarQr(e.target.files);
              e.target.value = "";
            }}
          />
          <div style={{ fontSize: 13 }}>
            <strong>Escolhe ou arrasta faturas</strong> (PDF, PNG, JPG)
            <span className="al-hint" style={{ display: "block", margin: 0 }}>
              O QR fiscal é lido no teu browser — sem servidor, sem custos.
            </span>
          </div>
          <span className="al-btn" style={{ marginLeft: "auto" }}>
            {processando ? "A ler…" : "Escolher ficheiros"}
          </span>
        </label>
      ) : (
        <div className="al-card" style={{ padding: 16, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ fontSize: 13 }}>
              <strong>Carrega o ficheiro Excel/CSV</strong>{" "}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  carregarExcel(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
                style={{ marginLeft: 8 }}
              />
            </label>
            <button
              type="button"
              className="al-btn"
              onClick={descarregarModelo}
            >
              Descarregar modelo (.xlsx)
            </button>
          </div>
          {excelRows.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {(
                  [
                    ["Fornecedor", colForn, setColForn],
                    ["Data", colData, setColData],
                    ["Base", colBase, setColBase],
                    ["IVA", colIva, setColIva],
                    ["Centro custo (opc.)", colCc, setColCc],
                  ] as const
                ).map(([label, val, set]) => (
                  <label key={label} style={{ fontSize: 12, color: "var(--muted)" }}>
                    {label}
                    <br />
                    <select
                      value={val}
                      onChange={(e) => set(Number(e.target.value))}
                      style={{ ...inputStyle, width: "auto" }}
                    >
                      {label.includes("opc.") && <option value={-1}>—</option>}
                      {excelRows[0].map((_, i) => (
                        <option key={i} value={i}>
                          Coluna {COLUNAS[i] ?? i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={cabecalho}
                    onChange={(e) => setCabecalho(e.target.checked)}
                  />{" "}
                  1ª linha é cabeçalho
                </label>
                <button type="button" className="al-btn" onClick={gerarDeExcel}>
                  Gerar {cabecalho ? excelRows.length - 1 : excelRows.length} rascunhos
                </button>
              </div>
              <p className="al-hint" style={{ marginBottom: 0 }}>
                Pré-visualização: {excelRows.length} linha(s). O Centro de custo
                por nome cai no selecionado abaixo se não bater.
              </p>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div
          className="al-card"
          style={{
            padding: 14,
            marginBottom: 16,
            borderColor: resultado.ok > 0 ? "var(--pos)" : "var(--neg)",
          }}
        >
          {resultado.ok > 0 && (
            <p style={{ margin: "0 0 6px" }}>
              <strong>{resultado.ok}</strong> custo(s) importado(s).{" "}
              <a href="/custos" style={{ color: "var(--pos)", fontWeight: 600 }}>
                Ver custos →
              </a>
            </p>
          )}
          {resultado.duplicadas > 0 && (
            <p className="al-hint" style={{ margin: "0 0 6px" }}>
              {resultado.duplicadas} fatura(s) repetida(s) ignorada(s).
            </p>
          )}
          {resultado.erros.map((e, i) => (
            <p key={i} className="al-hint" style={{ margin: 0, color: "var(--neg)" }}>
              {e}
            </p>
          ))}
        </div>
      )}

      {linhas.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
              padding: "10px 12px",
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
              Aplicar a todas:
            </span>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              Centro de custo
              <br />
              <select
                value={bCc}
                onChange={(e) => {
                  setBCc(e.target.value);
                  setBCasa("");
                }}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="">—</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              Casa (opc.)
              <br />
              <select
                value={bCasa}
                onChange={(e) => setBCasa(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
                disabled={!bCc}
              >
                <option value="">—</option>
                {casasDoCc(bCc).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              Pago por
              <br />
              <select
                value={bPagoTipo}
                onChange={(e) => setBPagoTipo(e.target.value as PagoPorTipo)}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="sopro">Sopro</option>
                <option value="cc">Centro de custo</option>
              </select>
            </label>
            {bPagoTipo === "cc" && (
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                CC pagador
                <br />
                <select
                  value={bPagoCc}
                  onChange={(e) => setBPagoCc(e.target.value)}
                  style={{ ...inputStyle, width: "auto" }}
                >
                  <option value="">—</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="al-btn" onClick={aplicarATodas}>
              Aplicar
            </button>
          </div>

          <div className="al-card" style={{ overflowX: "auto" }}>
            <table className="al-table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Fornecedor / doc.</th>
                  <th style={{ minWidth: 120 }}>Data</th>
                  <th className="al-r" style={{ minWidth: 90 }}>
                    Base
                  </th>
                  <th className="al-r" style={{ minWidth: 80 }}>
                    IVA
                  </th>
                  <th style={{ minWidth: 130 }}>Centro custo</th>
                  <th style={{ minWidth: 120 }}>Casa</th>
                  <th style={{ minWidth: 150 }}>Pago por</th>
                  <th style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const valida = linhaValida(l);
                  return (
                    <tr key={l.cid} style={valida ? undefined : { background: "var(--paper)" }}>
                      <td>
                        <input
                          value={l.fornecedor}
                          placeholder={l.nif ? `NIF ${l.nif}` : "Fornecedor"}
                          onChange={(e) =>
                            setLinha(l.cid, { fornecedor: e.target.value })
                          }
                          style={inputStyle}
                        />
                        {(l.descricao || l.ficheiro) && (
                          <span
                            className="al-hint"
                            style={{ display: "block", margin: "2px 0 0" }}
                          >
                            {l.descricao}
                            {l.ficheiro ? ` · ${l.ficheiro}` : ""}
                          </span>
                        )}
                        {avisosDe(l).map((a, i) => (
                          <span
                            key={i}
                            className="al-hint"
                            style={{ display: "block", margin: "2px 0 0", color: "var(--neg)" }}
                          >
                            ⚠ {a}
                          </span>
                        ))}
                      </td>
                      <td>
                        <input
                          type="date"
                          value={l.data}
                          onChange={(e) => setLinha(l.cid, { data: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td className="al-r">
                        <input
                          inputMode="decimal"
                          value={l.valor_base}
                          onChange={(e) =>
                            setLinha(l.cid, { valor_base: e.target.value })
                          }
                          style={{ ...inputStyle, textAlign: "right" }}
                        />
                      </td>
                      <td className="al-r">
                        <input
                          inputMode="decimal"
                          value={l.iva}
                          onChange={(e) => setLinha(l.cid, { iva: e.target.value })}
                          style={{ ...inputStyle, textAlign: "right" }}
                        />
                      </td>
                      <td>
                        <select
                          value={l.centro_custo_id}
                          onChange={(e) =>
                            setLinha(l.cid, {
                              centro_custo_id: e.target.value,
                              casa_id: "",
                            })
                          }
                          style={inputStyle}
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
                          value={l.casa_id}
                          onChange={(e) => setLinha(l.cid, { casa_id: e.target.value })}
                          style={inputStyle}
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
                        <div style={{ display: "flex", gap: 4 }}>
                          <select
                            value={l.pago_por_tipo}
                            onChange={(e) =>
                              setLinha(l.cid, {
                                pago_por_tipo: e.target.value as PagoPorTipo,
                              })
                            }
                            style={inputStyle}
                          >
                            <option value="sopro">Sopro</option>
                            <option value="cc">CC</option>
                          </select>
                          {l.pago_por_tipo === "cc" && (
                            <select
                              value={l.pago_por_cc_id}
                              onChange={(e) =>
                                setLinha(l.cid, { pago_por_cc_id: e.target.value })
                              }
                              style={inputStyle}
                            >
                              <option value="">—</option>
                              {centros.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="al-back"
                          style={{ padding: 0 }}
                          title="Remover"
                          onClick={() => removerLinha(l.cid)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 14,
            }}
          >
            <button
              type="button"
              className="al-btn"
              onClick={guardar}
              disabled={aGuardar || validas.length === 0}
            >
              {aGuardar
                ? "A gravar…"
                : `Gravar ${validas.length} custo(s) · ${totalImportar.toFixed(2)} €`}
            </button>
            <span className="al-hint" style={{ margin: 0 }}>
              {linhas.length - validas.length > 0
                ? `${linhas.length - validas.length} por completar (faltam campos).`
                : "Tudo pronto a gravar."}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

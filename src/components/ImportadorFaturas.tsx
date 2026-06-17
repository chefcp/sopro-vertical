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
import { puxarToconlineAction } from "@/lib/actions/toconline";
import {
  guardarClassificacaoFornecedorAction,
  type ClassificacaoFornecedor,
} from "@/lib/actions/classificacoes";
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
  taxa_plataforma: boolean;
  toconline_id: string | null;
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
  classificacoesIniciais = {},
}: {
  centros: Centro[];
  casas: Casa[];
  orgId: string;
  orgNif: string | null;
  nomesPorNif: Record<string, string>;
  classificacoesIniciais?: Record<string, ClassificacaoFornecedor>;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"qr" | "excel" | "toconline">("qr");
  const [linhas, setLinhas] = useState<Rascunho[]>([]);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ImportarResultado | null>(null);
  const [aGravar, startGravar] = useTransition();

  // Seleção de linhas (para aplicar classificação só às escolhidas).
  const [sel, setSel] = useState<Set<string>>(new Set());

  // Classificação em bulk.
  const [bCc, setBCc] = useState("");
  const [bCasa, setBCasa] = useState("");
  const [bPagoTipo, setBPagoTipo] = useState<PagoPorTipo>("sopro");
  const [bPagoCc, setBPagoCc] = useState("");

  // Memória de classificação por fornecedor (NIF → defaults).
  const [classif, setClassif] = useState<Record<string, ClassificacaoFornecedor>>(
    classificacoesIniciais,
  );

  // Ordenação e filtro da lista de revisão.
  const [vFiltro, setVFiltro] = useState("");
  const [vSort, setVSort] = useState<"fornecedor" | "data" | "valor_base" | "iva">("data");
  const [vDir, setVDir] = useState<"asc" | "desc">("asc");

  // TOConline.
  const hoje = new Date();
  const fmtData = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const [tocDesde, setTocDesde] = useState(fmtData(hoje.getFullYear(), 1, 1));
  const [tocAte, setTocAte] = useState(
    fmtData(hoje.getFullYear(), hoje.getMonth() + 1, ultimoDiaMes),
  );
  const [tocPuxando, setTocPuxando] = useState(false);
  const [tocMsg, setTocMsg] = useState<string | null>(null);
  const [tocAmostra, setTocAmostra] = useState<string | null>(null);

  // Excel.
  const [excelRows, setExcelRows] = useState<string[][]>([]);
  const [cabecalho, setCabecalho] = useState(true);
  const [colNif, setColNif] = useState(0);
  const [colForn, setColForn] = useState(1);
  const [colData, setColData] = useState(2);
  const [colBase, setColBase] = useState(3);
  const [colIva, setColIva] = useState(4);
  const [colCc, setColCc] = useState(5);
  const [colPago, setColPago] = useState(6);
  const [colAtcud, setColAtcud] = useState(7);

  const novaLinha = (p: Partial<Rascunho>): Rascunho => {
    // Pré-preenche pela memória do fornecedor (NIF), se existir.
    const mem = p.nif ? classif[p.nif] : undefined;
    const base: Rascunho = {
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
      taxa_plataforma: false,
      toconline_id: null,
      file: null,
      ficheiro: null,
    };
    const comMem: Partial<Rascunho> = mem
      ? {
          centro_custo_id: mem.centro_custo_id ?? base.centro_custo_id,
          casa_id: mem.casa_id ?? "",
          taxa_plataforma: mem.taxa_plataforma,
          pago_por_tipo: mem.pago_por_cc_id ? "cc" : base.pago_por_tipo,
          pago_por_cc_id: mem.pago_por_cc_id ?? base.pago_por_cc_id,
        }
      : {};
    return { ...base, ...comMem, ...p };
  };

  const setLinha = (cid: string, patch: Partial<Rascunho>) =>
    setLinhas((prev) => prev.map((l) => (l.cid === cid ? { ...l, ...patch } : l)));
  const removerLinha = (cid: string) => {
    setLinhas((prev) => prev.filter((l) => l.cid !== cid));
    setSel((prev) => {
      if (!prev.has(cid)) return prev;
      const n = new Set(prev);
      n.delete(cid);
      return n;
    });
  };

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
      [
        "NIF",
        "Fornecedor",
        "Data (AAAA-MM-DD)",
        "Base",
        "IVA",
        "Centro de custo",
        "Pago por",
        "ATCUD / código",
      ],
      ["510698905", "EDP Comercial", "2026-05-12", "71.14", "16.36", "Pico", "Sopro", "JJSH2ZKP-889"],
      ["504499777", "Galp Energia", "2026-05-09", "40.65", "9.35", "Atafona", "Atafona", ""],
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
        const nif = get(colNif);
        const ccNome = get(colCc).toLowerCase();
        const ccMatch = centros.find((c) => c.nome.toLowerCase() === ccNome);
        // Pago por: "Sopro"/vazio = Sopro; nome de um CC = pago por esse CC.
        const pagoStr = get(colPago).toLowerCase();
        const pagoCc =
          pagoStr && pagoStr !== "sopro"
            ? centros.find((c) => c.nome.toLowerCase() === pagoStr)
            : undefined;
        // Se o NIF já é conhecido, mantém o nome guardado (ignora o do ficheiro).
        const fornecedor = (nif && nomesPorNif[nif]) || get(colForn);
        return novaLinha({
          nif,
          atcud: get(colAtcud),
          fornecedor,
          data: normalizarData(get(colData)),
          valor_base: parseValor(get(colBase)),
          iva: parseValor(get(colIva)),
          centro_custo_id: ccMatch?.id ?? bCc,
          pago_por_tipo: pagoCc ? "cc" : "sopro",
          pago_por_cc_id: pagoCc ? pagoCc.id : "",
        });
      });
    setLinhas((prev) => [...prev, ...novas]);
    setExcelRows([]);
  }

  async function puxarToconline() {
    setTocPuxando(true);
    setTocMsg(null);
    setResultado(null);
    const res = await puxarToconlineAction(tocDesde || undefined, tocAte || undefined);
    setTocAmostra(res.amostra ?? null);
    if (res.erro) {
      setTocMsg(res.erro);
      setTocPuxando(false);
      return;
    }
    // Não voltar a juntar documentos que já estão na lista de revisão.
    const jaNaLista = new Set(
      linhas.map((l) => l.toconline_id).filter(Boolean) as string[],
    );
    const porAdicionar = res.novos.filter((d) => !jaNaLista.has(d.toconline_id));
    const repetidosNaLista = res.novos.length - porAdicionar.length;
    const novas = porAdicionar.map((d) =>
      novaLinha({
        nif: d.fornecedor_nif,
        fornecedor: (d.fornecedor_nif && nomesPorNif[d.fornecedor_nif]) || d.fornecedor_nome,
        descricao: [d.tipo, d.numero].filter(Boolean).join(" "),
        data: d.data,
        valor_base: String(d.valor_base),
        iva: String(d.iva),
        toconline_id: d.toconline_id,
        aviso: !d.fornecedor_nome && !d.fornecedor_nif ? "Sem fornecedor — confirma" : undefined,
      }),
    );
    setLinhas((prev) => [...prev, ...novas]);
    const partes = [`Lidos ${res.totalLidos}`];
    if (res.jaImportados > 0) partes.push(`${res.jaImportados} já importado(s)`);
    if (repetidosNaLista > 0) partes.push(`${repetidosNaLista} já na lista`);
    setTocMsg(
      novas.length > 0
        ? `${novas.length} documento(s) novo(s). ${partes.join(" · ")}.`
        : `Nada de novo. ${partes.join(" · ")}.`,
    );
    setTocPuxando(false);
  }

  const toggleSel = (cid: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });

  // Vista da lista de revisão: filtro por nome/NIF + ordenação.
  const linhasVista = useMemo(() => {
    let arr = linhas;
    const q = vFiltro.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (l) => l.fornecedor.toLowerCase().includes(q) || l.nif.includes(q),
      );
    }
    const dir = vDir === "asc" ? 1 : -1;
    return [...arr].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (vSort) {
        case "fornecedor":
          va = a.fornecedor.toLowerCase();
          vb = b.fornecedor.toLowerCase();
          break;
        case "data":
          va = a.data;
          vb = b.data;
          break;
        case "valor_base":
          va = Number(a.valor_base) || 0;
          vb = Number(b.valor_base) || 0;
          break;
        case "iva":
          va = Number(a.iva) || 0;
          vb = Number(b.iva) || 0;
          break;
      }
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt");
      return cmp * dir;
    });
  }, [linhas, vFiltro, vSort, vDir]);

  const ordenarPor = (k: typeof vSort) => {
    if (k === vSort) setVDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setVSort(k);
      setVDir(k === "data" ? "desc" : "asc");
    }
  };
  const seta = (k: typeof vSort) => (vSort === k ? (vDir === "asc" ? " ▲" : " ▼") : "");

  // "Selecionar todas" opera sobre as linhas VISÍVEIS (filtradas).
  const todasSel =
    linhasVista.length > 0 && linhasVista.every((l) => sel.has(l.cid));
  const toggleTodasSel = () =>
    setSel((prev) => {
      const n = new Set(prev);
      if (todasSel) linhasVista.forEach((l) => n.delete(l.cid));
      else linhasVista.forEach((l) => n.add(l.cid));
      return n;
    });

  // Botão por linha: MEMORIZA a classificação do fornecedor (NIF). Permite CC a
  // branco (ex.: Airbnb = só taxa de plataforma; o CC escolhe-se a cada fatura).
  const [nifAMemorizar, setNifAMemorizar] = useState<string | null>(null);

  async function memorizarLinha(l: Rascunho) {
    const nif = l.nif.trim();
    if (!nif) {
      window.alert("Esta linha não tem NIF — preenche o NIF para memorizar o fornecedor.");
      return;
    }
    const c: ClassificacaoFornecedor = {
      nif,
      centro_custo_id: l.centro_custo_id || null,
      casa_id: l.casa_id || null,
      pago_por_cc_id: l.pago_por_tipo === "cc" ? l.pago_por_cc_id || null : null,
      taxa_plataforma: l.taxa_plataforma,
    };
    setNifAMemorizar(nif);
    try {
      const r = await guardarClassificacaoFornecedorAction(c);
      if (r.error) {
        window.alert(r.error);
        return;
      }
      setClassif((prev) => ({ ...prev, [nif]: c }));
    } finally {
      setNifAMemorizar(null);
    }
  }

  // Grava no livro os custos SELECIONADOS (seleção consciente, não "tudo").
  function gravarSelecionados() {
    const alvo = linhas.filter((l) => sel.has(l.cid) && linhaValida(l));
    if (alvo.length === 0) {
      window.alert(
        "Seleciona linhas completas para gravar (com fornecedor, data, valores, CC e quem pagou).",
      );
      return;
    }
    startGravar(async () => {
      const supabase = createClient();
      const payload: CustoImportado[] = [];
      const cids: string[] = [];
      for (let i = 0; i < alvo.length; i++) {
        const l = alvo[i];
        let storage_path: string | null = null;
        if (l.file) {
          const path = `${orgId}/custo/${Date.now()}-${i}-${nomeSeguro(l.file.name)}`;
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
          taxa_plataforma: l.taxa_plataforma,
          nif: l.nif || null,
          atcud: l.atcud || null,
          toconline_id: l.toconline_id,
          storage_path,
          nome_ficheiro: l.ficheiro,
        });
        cids.push(l.cid);
      }
      const res = await importarCustosAction(payload);
      setLinhas((prev) => prev.filter((x) => !cids.includes(x.cid)));
      setSel((prev) => {
        const n = new Set(prev);
        cids.forEach((c) => n.delete(c));
        return n;
      });
      setResultado(res);
      router.refresh();
    });
  }

  function aplicarASelecionadas() {
    if (sel.size === 0) return; // só mexe nas selecionadas
    setLinhas((prev) =>
      prev.map((l) =>
        !sel.has(l.cid)
          ? l
          : {
              ...l,
              centro_custo_id: bCc || l.centro_custo_id,
              casa_id: bCasa,
              pago_por_tipo: bPagoTipo,
              pago_por_cc_id: bPagoTipo === "cc" ? bPagoCc : "",
            },
      ),
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
        <button
          type="button"
          className={`al-tab ${modo === "toconline" ? "on" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => setModo("toconline")}
        >
          Do TOConline
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
      ) : modo === "excel" ? (
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
                    ["NIF (opc.)", colNif, setColNif],
                    ["Fornecedor", colForn, setColForn],
                    ["Data", colData, setColData],
                    ["Base", colBase, setColBase],
                    ["IVA", colIva, setColIva],
                    ["Centro custo (opc.)", colCc, setColCc],
                    ["Pago por (opc.)", colPago, setColPago],
                    ["ATCUD (opc.)", colAtcud, setColAtcud],
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
      ) : (
        <div className="al-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: 13 }}>
              <strong>Puxar documentos de compra do TOConline</strong>
              <span className="al-hint" style={{ display: "block", margin: "2px 0 6px" }}>
                Só os documentos finalizados ainda não importados. Liga primeiro
                em Configuração → TOConline.
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                <span>
                  Desde{" "}
                  <input
                    type="date"
                    value={tocDesde}
                    onChange={(e) => setTocDesde(e.target.value)}
                    style={{ ...inputStyle, width: "auto", display: "inline-block" }}
                  />
                </span>
                <span>
                  até{" "}
                  <input
                    type="date"
                    value={tocAte}
                    onChange={(e) => setTocAte(e.target.value)}
                    style={{ ...inputStyle, width: "auto", display: "inline-block" }}
                  />
                </span>
              </span>
            </label>
            <button
              type="button"
              className="al-btn"
              onClick={puxarToconline}
              disabled={tocPuxando}
            >
              {tocPuxando ? "A puxar…" : "Puxar agora"}
            </button>
          </div>
          {tocMsg && (
            <p className="al-hint" style={{ margin: "10px 0 0" }}>
              {tocMsg}
            </p>
          )}
          {tocAmostra && (
            <details style={{ marginTop: 10 }}>
              <summary className="al-hint" style={{ cursor: "pointer" }}>
                Amostra do 1º documento (para diagnóstico)
              </summary>
              <pre
                style={{
                  fontSize: 11,
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 6,
                  maxHeight: 280,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {tocAmostra}
              </pre>
            </details>
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
              {sel.size > 0
                ? `Aplicar a ${sel.size} selecionada(s):`
                : "Seleciona linhas para aplicar:"}
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
                <option value="sopro">Geral (Sopro)</option>
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
            <button
              type="button"
              className="al-btn"
              onClick={aplicarASelecionadas}
              disabled={sel.size === 0}
            >
              Aplicar
            </button>
            {sel.size > 0 && (
              <button
                type="button"
                className="al-back"
                style={{ padding: 0, alignSelf: "center" }}
                onClick={() => setSel(new Set())}
              >
                limpar seleção
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <input
              placeholder="Filtrar por fornecedor ou NIF…"
              value={vFiltro}
              onChange={(e) => setVFiltro(e.target.value)}
              style={{ ...inputStyle, width: "auto", minWidth: 220 }}
            />
            <button
              type="button"
              className="al-btn"
              onClick={toggleTodasSel}
              disabled={linhasVista.length === 0}
            >
              {todasSel ? "Desmarcar visíveis" : "Selecionar visíveis"}
            </button>
            <span className="al-hint" style={{ margin: 0 }}>
              {linhasVista.length} de {linhas.length} · {sel.size} selecionada(s)
            </span>
          </div>

          <div className="al-card" style={{ overflowX: "auto" }}>
            <table className="al-table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      checked={todasSel}
                      onChange={toggleTodasSel}
                      title="Selecionar todas"
                    />
                  </th>
                  <th
                    style={{ minWidth: 160, cursor: "pointer", userSelect: "none" }}
                    onClick={() => ordenarPor("fornecedor")}
                  >
                    Fornecedor / doc.{seta("fornecedor")}
                  </th>
                  <th
                    style={{ minWidth: 120, cursor: "pointer", userSelect: "none" }}
                    onClick={() => ordenarPor("data")}
                  >
                    Data{seta("data")}
                  </th>
                  <th
                    className="al-r"
                    style={{ minWidth: 90, cursor: "pointer", userSelect: "none" }}
                    onClick={() => ordenarPor("valor_base")}
                  >
                    Base{seta("valor_base")}
                  </th>
                  <th
                    className="al-r"
                    style={{ minWidth: 80, cursor: "pointer", userSelect: "none" }}
                    onClick={() => ordenarPor("iva")}
                  >
                    IVA{seta("iva")}
                  </th>
                  <th style={{ minWidth: 130 }}>Centro custo</th>
                  <th style={{ minWidth: 120 }}>Casa</th>
                  <th style={{ minWidth: 150 }}>Pago por</th>
                  <th style={{ width: 56 }}></th>
                </tr>
              </thead>
              <tbody>
                {linhasVista.map((l) => {
                  const valida = linhaValida(l);
                  return (
                    <tr key={l.cid} style={valida ? undefined : { background: "var(--paper)" }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={sel.has(l.cid)}
                          onChange={() => toggleSel(l.cid)}
                        />
                      </td>
                      <td>
                        <input
                          value={l.fornecedor}
                          placeholder="Fornecedor"
                          onChange={(e) =>
                            setLinha(l.cid, { fornecedor: e.target.value })
                          }
                          style={inputStyle}
                        />
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <input
                            value={l.nif}
                            placeholder="NIF"
                            onChange={(e) => setLinha(l.cid, { nif: e.target.value })}
                            style={{ ...inputStyle, fontSize: 12, padding: "4px 6px" }}
                          />
                          <input
                            value={l.atcud}
                            placeholder="ATCUD / código"
                            onChange={(e) => setLinha(l.cid, { atcud: e.target.value })}
                            style={{ ...inputStyle, fontSize: 12, padding: "4px 6px" }}
                          />
                        </div>
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
                        <label
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)", marginBottom: 4 }}
                        >
                          <input
                            type="checkbox"
                            checked={l.taxa_plataforma}
                            onChange={(e) =>
                              setLinha(l.cid, { taxa_plataforma: e.target.checked })
                            }
                          />
                          taxa plataforma
                        </label>
                        {!l.taxa_plataforma && (
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
                              <option value="sopro">Geral</option>
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
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            className="al-btn"
                            style={{
                              padding: "5px 10px",
                              fontSize: 12,
                              ...(classif[l.nif.trim()]
                                ? { borderColor: "var(--pos)", color: "var(--pos)" }
                                : {}),
                            }}
                            title={
                              classif[l.nif.trim()]
                                ? "Fornecedor memorizado — clica para atualizar com estes valores (CC pode ficar a branco)"
                                : "Memorizar esta classificação para o fornecedor (CC pode ficar a branco)"
                            }
                            onClick={() => memorizarLinha(l)}
                            disabled={!l.nif.trim() || nifAMemorizar === l.nif.trim()}
                          >
                            {nifAMemorizar === l.nif.trim()
                              ? "A memorizar…"
                              : classif[l.nif.trim()]
                                ? "Memorizado ✓"
                                : "Memorizar"}
                          </button>
                          <button
                            type="button"
                            className="al-back"
                            style={{ padding: 0 }}
                            title="Remover"
                            onClick={() => removerLinha(l.cid)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}
          >
            <button
              type="button"
              className="al-btn"
              onClick={gravarSelecionados}
              disabled={aGravar || sel.size === 0}
            >
              {aGravar ? "A gravar…" : `Gravar ${sel.size} selecionado(s)`}
            </button>
            <span className="al-hint" style={{ margin: 0 }}>
              O <strong>Memorizar</strong> (em cada linha) guarda a classificação do
              fornecedor para a próxima vez (o CC pode ficar a branco). O{" "}
              <strong>Gravar selecionados</strong> lança no livro só as linhas que
              escolheres — {validas.length} de {linhas.length} estão completas.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

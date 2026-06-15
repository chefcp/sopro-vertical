import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { FormularioCusto } from "@/components/FormularioCusto";
import { apagarCustoAction, duplicarCustoAction } from "@/lib/actions/custos";
import { DocumentosEntidade } from "@/components/DocumentosEntidade";
import { documentosDaEntidade } from "@/lib/documentos";
import { Valor } from "@/components/Valor";
import { eur, dataPt } from "@/lib/format";
import type { Custo, Alocacao } from "@/lib/types";

const CONTA_LABEL: Record<string, string> = {
  resultado: "Resultado",
  iva: "IVA",
  suprimentos: "Suprimentos",
  tesouraria: "Tesouraria",
  cc_corrente: "Conta-corrente",
};

export const metadata = { title: "Editar custo · Sopro" };

export default async function EditarCustoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) notFound();

  const supabase = await createClient();
  const { data: custoData } = await supabase
    .from("custos")
    .select(
      "id, fornecedor, nif, atcud, descricao, data, data_pagamento, valor_base, iva, total, taxa_plataforma, pago_por_tipo, pago_por_pessoa_id, pago_por_cc_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!custoData) notFound();
  const c = custoData as Custo;

  const [
    { data: alocData },
    { data: centrosData },
    { data: casasData },
    { data: fornData },
    { data: lancData },
  ] = await Promise.all([
    supabase
      .from("alocacoes")
      .select("centro_custo_id, casa_id, percentagem")
      .eq("custo_id", id),
    supabase.from("centros_custo").select("id, nome").order("ordem"),
    supabase.from("casas").select("id, nome, centro_custo_id").order("nome"),
    supabase.from("fornecedores").select("nif, nome"),
    supabase
      .from("lancamentos")
      .select("id, data, conta, valor, descricao, centro_custo_id, casa_id")
      .eq("origem", "custo")
      .eq("origem_id", id)
      .order("data"),
  ]);

  const centros = (centrosData ?? []) as { id: string; nome: string }[];
  const casas = (casasData ?? []) as {
    id: string;
    nome: string;
    centro_custo_id: string;
  }[];
  const nomesPorNif: Record<string, string> = {};
  for (const f of (fornData ?? []) as { nif: string; nome: string }[]) {
    nomesPorNif[f.nif] = f.nome;
  }
  const casaNome = new Map(casas.map((c) => [c.id, c.nome]));
  const lancCusto = (lancData ?? []) as {
    id: string;
    data: string;
    conta: string;
    valor: number;
    descricao: string | null;
    casa_id: string | null;
  }[];
  const alocacoes = ((alocData ?? []) as Alocacao[]).map((a) => ({
    centro_custo_id: a.centro_custo_id,
    casa_id: a.casa_id ?? "",
    percentagem: String(a.percentagem),
  }));
  const docs = await documentosDaEntidade(supabase, "custo", c.id);

  const inicial = {
    fornecedor: c.fornecedor,
    nif: c.nif ?? "",
    atcud: c.atcud ?? "",
    descricao: c.descricao ?? "",
    data: c.data,
    data_pagamento: c.data_pagamento ?? "",
    valor_base: String(c.valor_base ?? 0),
    iva: String(c.iva ?? 0),
    taxa_plataforma: !!c.taxa_plataforma,
    pago_por_cc_id: c.pago_por_cc_id ?? "",
    alocacoes:
      alocacoes.length > 0
        ? alocacoes
        : [{ centro_custo_id: "", casa_id: "", percentagem: "" }],
  };

  return (
    <div>
      <Link href="/custos" className="al-back">
        ← Custos
      </Link>
      <div className="al-head">
        <h1>Editar custo</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <form action={duplicarCustoAction}>
            <input type="hidden" name="id" value={c.id} />
            <button type="submit" className="al-back" style={{ padding: "9px 0" }}>
              Duplicar
            </button>
          </form>
          <form action={apagarCustoAction}>
            <input type="hidden" name="id" value={c.id} />
            <button type="submit" className="al-back" style={{ padding: "9px 0" }}>
              Apagar custo
            </button>
          </form>
        </div>
      </div>
      <div className="al-card" style={{ padding: 20 }}>
        <FormularioCusto
          centros={centros}
          casas={casas}
          modo="editar"
          custoId={c.id}
          inicial={inicial}
          nomesPorNif={nomesPorNif}
        />
      </div>

      <h2 className="al-h2">Lançamentos gerados</h2>
      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Conta</th>
              <th>Casa</th>
              <th>Descrição</th>
              <th className="al-r">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lancCusto.map((l) => (
              <tr key={l.id}>
                <td className="al-mono">{dataPt(l.data)}</td>
                <td>
                  {l.conta === "iva" ? (
                    <span className="al-iva">IVA</span>
                  ) : (
                    CONTA_LABEL[l.conta] ?? l.conta
                  )}
                </td>
                <td className="al-dim">
                  {l.casa_id ? (casaNome.get(l.casa_id) ?? "—") : "—"}
                </td>
                <td className="al-dim">{l.descricao ?? "—"}</td>
                <td className="al-r">
                  <Valor n={Number(l.valor)} />
                </td>
              </tr>
            ))}
            {lancCusto.length === 0 && (
              <tr>
                <td colSpan={5} className="al-hint" style={{ padding: 20 }}>
                  Sem lançamentos (custo por gravar ou sem pagamento).
                </td>
              </tr>
            )}
          </tbody>
          {lancCusto.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="al-r" style={{ fontWeight: 600 }}>
                  Soma
                </td>
                <td className="al-r">
                  <span className="al-num">
                    {eur(lancCusto.reduce((s, l) => s + Number(l.valor), 0))}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <h2 className="al-h2">Documentos</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <DocumentosEntidade entidadeTipo="custo" entidadeId={c.id} docs={docs} />
      </div>
    </div>
  );
}

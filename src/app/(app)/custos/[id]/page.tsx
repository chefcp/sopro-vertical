import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { FormularioCusto } from "@/components/FormularioCusto";
import { apagarCustoAction } from "@/lib/actions/custos";
import { DocumentosEntidade } from "@/components/DocumentosEntidade";
import { documentosDaEntidade } from "@/lib/documentos";
import type { Custo, Alocacao } from "@/lib/types";

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
      "id, fornecedor, descricao, data, valor_base, iva, total, pago_por_tipo, pago_por_pessoa_id, pago_por_cc_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!custoData) notFound();
  const c = custoData as Custo;

  const [{ data: alocData }, { data: centrosData }, { data: casasData }] =
    await Promise.all([
      supabase
        .from("alocacoes")
        .select("centro_custo_id, casa_id, percentagem")
        .eq("custo_id", id),
      supabase.from("centros_custo").select("id, nome").order("ordem"),
      supabase.from("casas").select("id, nome, centro_custo_id").order("nome"),
    ]);

  const centros = (centrosData ?? []) as { id: string; nome: string }[];
  const casas = (casasData ?? []) as {
    id: string;
    nome: string;
    centro_custo_id: string;
  }[];
  const alocacoes = ((alocData ?? []) as Alocacao[]).map((a) => ({
    centro_custo_id: a.centro_custo_id,
    casa_id: a.casa_id ?? "",
    percentagem: String(a.percentagem),
  }));
  const docs = await documentosDaEntidade(supabase, "custo", c.id);

  const inicial = {
    fornecedor: c.fornecedor,
    descricao: c.descricao ?? "",
    data: c.data,
    valor_base: String(c.valor_base ?? 0),
    iva: String(c.iva ?? 0),
    pago_por_tipo: c.pago_por_tipo,
    pago_por_pessoa_id: c.pago_por_pessoa_id ?? "",
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
        <form action={apagarCustoAction}>
          <input type="hidden" name="id" value={c.id} />
          <button type="submit" className="al-back" style={{ padding: "9px 0" }}>
            Apagar custo
          </button>
        </form>
      </div>
      <div className="al-card" style={{ padding: 20 }}>
        <FormularioCusto
          centros={centros}
          casas={casas}
          modo="editar"
          custoId={c.id}
          inicial={inicial}
        />
      </div>

      <h2 className="al-h2">Documentos</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <DocumentosEntidade entidadeTipo="custo" entidadeId={c.id} docs={docs} />
      </div>
    </div>
  );
}

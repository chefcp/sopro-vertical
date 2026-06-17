"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";

export type ClassificacaoFornecedor = {
  nif: string;
  centro_custo_id: string | null;
  casa_id: string | null;
  pago_por_cc_id: string | null;
  taxa_plataforma: boolean;
};

/** Lê todas as classificações memorizadas (mapa NIF → classificação). */
export async function listarClassificacoesFornecedor(): Promise<
  Record<string, ClassificacaoFornecedor>
> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("classificacoes_fornecedor")
    .select("nif, centro_custo_id, casa_id, pago_por_cc_id, taxa_plataforma");
  const out: Record<string, ClassificacaoFornecedor> = {};
  for (const r of (data ?? []) as ClassificacaoFornecedor[]) {
    out[r.nif] = r;
  }
  return out;
}

/** Memoriza (cria/atualiza) a classificação por defeito de um fornecedor. */
export async function guardarClassificacaoFornecedorAction(
  c: ClassificacaoFornecedor,
): Promise<{ error?: string }> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const nif = c.nif?.trim();
  if (!nif) return { error: "Sem NIF — não dá para memorizar." };

  const supabase = await createClient();
  const { error } = await supabase.from("classificacoes_fornecedor").upsert(
    {
      org_id: sessao.orgId,
      nif,
      centro_custo_id: c.centro_custo_id || null,
      casa_id: c.casa_id || null,
      pago_por_cc_id: c.pago_por_cc_id || null,
      taxa_plataforma: !!c.taxa_plataforma,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "org_id,nif" },
  );
  if (error) return { error: error.message };
  revalidatePath("/config");
  revalidatePath("/custos/importar");
  return {};
}

/** Esquece a classificação memorizada de um fornecedor. */
export async function apagarClassificacaoFornecedorAction(
  nif: string,
): Promise<{ error?: string }> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("classificacoes_fornecedor")
    .delete()
    .eq("org_id", sessao.orgId)
    .eq("nif", nif);
  if (error) return { error: error.message };
  revalidatePath("/config");
  revalidatePath("/custos/importar");
  return {};
}

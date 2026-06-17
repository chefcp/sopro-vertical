"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";
import {
  envToconline,
  trocarCodigo,
  renovarToken,
  listarDocumentosCompra,
  type DocCompra,
} from "@/lib/toconline";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ToconlineState = { error?: string; mensagem?: string };

/** Estado da ligação (para a Configuração). */
export async function estadoToconline(): Promise<{
  configurado: boolean;
  ligado: boolean;
  ligado_em: string | null;
}> {
  const env = envToconline();
  const sessao = await getSessaoOrg();
  if (!env || !sessao?.orgId) {
    return { configurado: !!env, ligado: false, ligado_em: null };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("integracoes_toconline")
    .select("refresh_token, ligado_em")
    .eq("org_id", sessao.orgId)
    .maybeSingle();
  const row = data as { refresh_token: string | null; ligado_em: string | null } | null;
  return {
    configurado: true,
    ligado: !!row?.refresh_token,
    ligado_em: row?.ligado_em ?? null,
  };
}

/** Recebe o código colado pelo utilizador e guarda os tokens. */
export async function ligarToconlineAction(
  _prev: ToconlineState,
  formData: FormData,
): Promise<ToconlineState> {
  const env = envToconline();
  if (!env) return { error: "TOConline não está configurado no servidor." };
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Cola o código de autorização." };

  let tokens;
  try {
    tokens = await trocarCodigo(env, code);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao trocar o código." };
  }

  const supabase = await createClient();
  const expira = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const agora = new Date().toISOString();
  const { error } = await supabase.from("integracoes_toconline").upsert(
    {
      org_id: sessao.orgId,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expira_em: expira,
      ligado_em: agora,
      atualizado_em: agora,
    },
    { onConflict: "org_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/config");
  return { mensagem: "Ligado ao TOConline." };
}

/** Corta a ligação (apaga os tokens). */
export async function desligarToconlineAction(): Promise<ToconlineState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("integracoes_toconline")
    .delete()
    .eq("org_id", sessao.orgId);
  if (error) return { error: error.message };
  revalidatePath("/config");
  return { mensagem: "Ligação removida." };
}

/** Garante um access_token válido (renova com o refresh se preciso). */
async function tokenValido(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string> {
  const env = envToconline();
  if (!env) throw new Error("TOConline não está configurado no servidor.");

  const { data } = await supabase
    .from("integracoes_toconline")
    .select("refresh_token, access_token, expira_em")
    .eq("org_id", orgId)
    .maybeSingle();
  const row = data as
    | { refresh_token: string | null; access_token: string | null; expira_em: string | null }
    | null;
  if (!row?.refresh_token) {
    throw new Error("Não estás ligado ao TOConline. Liga primeiro na Configuração.");
  }

  // Ainda dentro da validade (com 60s de folga)?
  const folga = 60_000;
  if (row.access_token && row.expira_em && new Date(row.expira_em).getTime() - folga > Date.now()) {
    return row.access_token;
  }

  // Renova.
  const tokens = await renovarToken(env, row.refresh_token);
  const expira = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase
    .from("integracoes_toconline")
    .update({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expira_em: expira,
      atualizado_em: new Date().toISOString(),
    })
    .eq("org_id", orgId);
  return tokens.access_token;
}

export type PuxarToconlineResultado = {
  novos: DocCompra[];
  jaImportados: number;
  totalLidos: number;
  erro?: string;
  amostra?: string;
};

/**
 * Puxa documentos de compra do TOConline e devolve só os NOVOS (ainda não
 * importados — dedup por `toconline_id`). Não grava nada: alimenta a revisão.
 */
export async function puxarToconlineAction(
  desde?: string,
  ate?: string,
): Promise<PuxarToconlineResultado> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { novos: [], jaImportados: 0, totalLidos: 0, erro: "Sem organização." };
  const env = envToconline();
  if (!env) return { novos: [], jaImportados: 0, totalLidos: 0, erro: "TOConline não configurado." };

  const supabase = await createClient();

  let docs: DocCompra[];
  let amostra: string | undefined;
  try {
    const token = await tokenValido(supabase, sessao.orgId);
    const r = await listarDocumentosCompra(env, token);
    docs = r.docs;
    amostra = r.amostra ? JSON.stringify(r.amostra) : undefined;
  } catch (e) {
    return { novos: [], jaImportados: 0, totalLidos: 0, erro: e instanceof Error ? e.message : "Falha na ligação." };
  }

  // Filtro por data (cliente): entre `desde` e `ate`, se indicados.
  let candidatos = docs;
  if (desde) candidatos = candidatos.filter((d) => d.data >= desde);
  if (ate) candidatos = candidatos.filter((d) => d.data <= ate);

  // Dedup contra o que já existe (por toconline_id).
  const ids = candidatos.map((d) => d.toconline_id);
  const existentes = new Set<string>();
  if (ids.length > 0) {
    const { data } = await supabase
      .from("custos")
      .select("toconline_id")
      .eq("org_id", sessao.orgId)
      .in("toconline_id", ids);
    for (const r of (data ?? []) as { toconline_id: string | null }[]) {
      if (r.toconline_id) existentes.add(r.toconline_id);
    }
  }

  const novos = candidatos.filter((d) => !existentes.has(d.toconline_id));
  return {
    novos,
    jaImportados: candidatos.length - novos.length,
    totalLidos: docs.length,
    amostra,
  };
}

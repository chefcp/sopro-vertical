import type { SupabaseClient } from "@supabase/supabase-js";

export type DocEntidade = {
  id: string;
  nome_ficheiro: string | null;
  storage_path: string;
  url: string | null;
};

/** Documentos de uma entidade (reserva/custo) com URLs assinados (1h). */
export async function documentosDaEntidade(
  supabase: SupabaseClient,
  tipo: string,
  id: string,
): Promise<DocEntidade[]> {
  const { data } = await supabase
    .from("documentos")
    .select("id, nome_ficheiro, storage_path")
    .eq("entidade_tipo", tipo)
    .eq("entidade_id", id)
    .order("criado_em", { ascending: false });

  const docs = (data ?? []) as {
    id: string;
    nome_ficheiro: string | null;
    storage_path: string;
  }[];
  if (docs.length === 0) return [];

  const { data: assinados } = await supabase.storage
    .from("documentos")
    .createSignedUrls(
      docs.map((d) => d.storage_path),
      3600,
    );
  const urlByPath = new Map<string, string>();
  for (const a of assinados ?? []) {
    if (a.path && a.signedUrl) urlByPath.set(a.path, a.signedUrl);
  }
  return docs.map((d) => ({ ...d, url: urlByPath.get(d.storage_path) ?? null }));
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";

export type DocState = { error?: string; mensagem?: string };

const TIPOS = ["reserva", "custo", "suprimento"];
const MIME_PERMITIDOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const TAMANHO_MAX = 10 * 1024 * 1024; // 10 MB (limite do bucket)

/** Remove caracteres problemáticos do nome do ficheiro para o storage. */
function nomeSeguro(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function uploadDocumentoAction(
  _prev: DocState,
  formData: FormData,
): Promise<DocState> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return { error: "Sem organização." };
  const org = sessao.orgId;

  const tipo = String(formData.get("entidade_tipo") ?? "");
  const entidadeId = String(formData.get("entidade_id") ?? "");
  const ficheiro = formData.get("ficheiro");

  if (!TIPOS.includes(tipo)) return { error: "Indica o tipo." };
  if (!entidadeId) return { error: "Indica a que se refere o documento." };
  if (!(ficheiro instanceof File) || ficheiro.size === 0) {
    return { error: "Escolhe um ficheiro." };
  }
  if (ficheiro.size > TAMANHO_MAX) {
    return { error: "Ficheiro demasiado grande (máx. 10 MB)." };
  }
  if (ficheiro.type && !MIME_PERMITIDOS.includes(ficheiro.type)) {
    return { error: "Só são aceites PDF, PNG, JPEG ou WEBP." };
  }

  const supabase = await createClient();

  // O path TEM de começar pelo org_id (política de storage).
  const carimbo = Date.now();
  const path = `${org}/${tipo}/${entidadeId}/${carimbo}-${nomeSeguro(
    ficheiro.name,
  )}`;

  const bytes = await ficheiro.arrayBuffer();
  const { error: errUp } = await supabase.storage
    .from("documentos")
    .upload(path, bytes, {
      contentType: ficheiro.type || "application/octet-stream",
      upsert: false,
    });
  if (errUp) return { error: `Falha no upload: ${errUp.message}` };

  const { error: errIns } = await supabase.from("documentos").insert({
    org_id: org,
    entidade_tipo: tipo,
    entidade_id: entidadeId,
    storage_path: path,
    nome_ficheiro: ficheiro.name,
  });
  if (errIns) {
    // Reverte o ficheiro carregado se a linha não entrou.
    await supabase.storage.from("documentos").remove([path]);
    return { error: errIns.message };
  }

  revalidatePath("/documentos");
  return { mensagem: "Documento carregado." };
}

export async function apagarDocumentoAction(formData: FormData): Promise<void> {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) return;
  const id = String(formData.get("id") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!id) return;
  const supabase = await createClient();
  if (path) await supabase.storage.from("documentos").remove([path]);
  await supabase.from("documentos").delete().eq("id", id);
  revalidatePath("/documentos");
}

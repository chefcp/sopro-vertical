import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ImportadorFaturas } from "@/components/ImportadorFaturas";

export const metadata = { title: "Importar faturas · Sopro" };

export default async function ImportarFaturasPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Importar faturas</h1>
        </div>
        <div className="al-card" style={{ padding: 24 }}>
          <p className="al-hint" style={{ margin: 0 }}>
            Sem organização associada.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [
    { data: centrosData },
    { data: casasData },
    { data: fornData },
    { data: orgData },
  ] = await Promise.all([
    supabase.from("centros_custo").select("id, nome").order("ordem"),
    supabase.from("casas").select("id, nome, centro_custo_id").order("nome"),
    supabase.from("fornecedores").select("nif, nome"),
    supabase.from("organizacoes").select("nif").eq("id", sessao.orgId).maybeSingle(),
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
  const orgNif = ((orgData ?? null) as { nif: string | null } | null)?.nif ?? null;

  return (
    <div>
      <Link href="/custos" className="al-back">
        ← Custos
      </Link>
      <div className="al-head">
        <h1>Importar faturas</h1>
      </div>
      <p className="al-hint" style={{ marginTop: -6 }}>
        Lê o QR fiscal de várias faturas (no teu browser) ou importa custos de um
        Excel/CSV. Reveês, classificas e gravas — cada um entra no livro via{" "}
        <span className="al-mono">lancar_custo</span>.
      </p>
      <ImportadorFaturas
        centros={centros}
        casas={casas}
        orgId={sessao.orgId}
        orgNif={orgNif}
        nomesPorNif={nomesPorNif}
      />
    </div>
  );
}

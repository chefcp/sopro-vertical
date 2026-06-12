import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { FormularioCusto } from "@/components/FormularioCusto";

export const metadata = { title: "Novo custo · Sopro" };

export default async function NovoCustoPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <Link href="/custos" className="al-back">
          ← Custos
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: centrosData }, { data: casasData }, { data: fornData }] =
    await Promise.all([
      supabase.from("centros_custo").select("id, nome").order("ordem"),
      supabase.from("casas").select("id, nome, centro_custo_id").order("nome"),
      supabase.from("fornecedores").select("nif, nome"),
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

  return (
    <div>
      <Link href="/custos" className="al-back">
        ← Custos
      </Link>
      <div className="al-head">
        <h1>Novo custo</h1>
      </div>
      <div className="al-card" style={{ padding: 20 }}>
        <FormularioCusto
          centros={centros}
          casas={casas}
          modo="criar"
          nomesPorNif={nomesPorNif}
        />
      </div>
    </div>
  );
}

import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { GestaoCentros } from "@/components/config/GestaoCentros";
import { GestaoChaves } from "@/components/config/GestaoChaves";
import { GestaoTaxas } from "@/components/config/GestaoTaxas";

export const metadata = { title: "Configuração · Sopro" };

export default async function ConfigPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Configuração</h1>
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
  const [{ data: centrosData }, { data: chavesData }, { data: taxasData }] =
    await Promise.all([
      supabase
        .from("centros_custo")
        .select("id, nome, gera_faturacao, ordem")
        .order("ordem"),
      supabase
        .from("chaves_reparticao")
        .select("id, origem_cc_id, destino_cc_id, conta, peso")
        .order("criado_em"),
      supabase.from("taxas_canal").select("canal, percentagem"),
    ]);

  const centros = (centrosData ?? []) as {
    id: string;
    nome: string;
    gera_faturacao: boolean;
    ordem: number;
  }[];
  const chaves = (chavesData ?? []) as {
    id: string;
    origem_cc_id: string;
    destino_cc_id: string;
    conta: string;
    peso: number;
  }[];
  const taxas: Record<string, number> = {};
  for (const t of (taxasData ?? []) as { canal: string; percentagem: number }[]) {
    taxas[t.canal] = Number(t.percentagem);
  }

  return (
    <div>
      <div className="al-head">
        <h1>Configuração</h1>
      </div>

      <h2 className="al-h2">Centros de custo</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <GestaoCentros centros={centros} />
      </div>

      <h2 className="al-h2">Taxas por canal</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <GestaoTaxas taxas={taxas} />
      </div>

      <h2 className="al-h2">Chaves de repartição</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <GestaoChaves chaves={chaves} centros={centros} />
      </div>

      <p className="al-hint">
        As chaves de repartição definem como o saldo de uma conta de um centro
        de custo é distribuído por outros, ao usar &quot;Redistribuir
        conta&quot;.
      </p>
    </div>
  );
}

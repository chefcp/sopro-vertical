import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { GestaoCentros } from "@/components/config/GestaoCentros";
import { GestaoChaves } from "@/components/config/GestaoChaves";
import { GestaoTaxas } from "@/components/config/GestaoTaxas";
import { GestaoEmpresa } from "@/components/config/GestaoEmpresa";
import { LigacaoToconline } from "@/components/LigacaoToconline";
import { GestaoClassificacoes } from "@/components/config/GestaoClassificacoes";
import { estadoToconline } from "@/lib/actions/toconline";
import { listarClassificacoesFornecedor } from "@/lib/actions/classificacoes";
import { envToconline, urlAutorizacao } from "@/lib/toconline";

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
  const [
    { data: centrosData },
    { data: chavesData },
    { data: taxasData },
    { data: orgData },
    { data: casasData },
    { data: fornData },
  ] = await Promise.all([
    supabase
      .from("centros_custo")
      .select("id, nome, gera_faturacao, ordem")
      .order("ordem"),
    supabase
      .from("chaves_reparticao")
      .select("id, origem_cc_id, destino_cc_id, conta, peso")
      .order("criado_em"),
    supabase.from("taxas_canal").select("canal, percentagem"),
    supabase
      .from("organizacoes")
      .select("nif, morada")
      .eq("id", sessao.orgId)
      .maybeSingle(),
    supabase.from("casas").select("id, nome, centro_custo_id").order("nome"),
    supabase.from("fornecedores").select("nif, nome"),
  ]);
  const empresa = (orgData ?? { nif: null, morada: null }) as {
    nif: string | null;
    morada: string | null;
  };

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

  const envToc = envToconline();
  const estadoToc = await estadoToconline();
  const urlAutorizacaoToc = envToc ? urlAutorizacao(envToc) : "";

  const casasConfig = (casasData ?? []) as {
    id: string;
    nome: string;
    centro_custo_id: string;
  }[];
  const nomesPorNif: Record<string, string> = {};
  for (const f of (fornData ?? []) as { nif: string; nome: string }[]) {
    nomesPorNif[f.nif] = f.nome;
  }
  const classifMap = await listarClassificacoesFornecedor();
  const classificacoes = Object.values(classifMap);

  return (
    <div>
      <div className="al-head">
        <h1>Configuração</h1>
      </div>

      <h2 className="al-h2">Dados da empresa</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <GestaoEmpresa
          nif={empresa.nif ?? ""}
          morada={empresa.morada ?? ""}
        />
      </div>

      <h2 className="al-h2">TOConline (importar custos)</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <LigacaoToconline
          configurado={estadoToc.configurado}
          ligado={estadoToc.ligado}
          ligadoEm={estadoToc.ligado_em}
          urlAutorizacao={urlAutorizacaoToc}
        />
      </div>

      <h2 className="al-h2">Memória de fornecedores (importação)</h2>
      <div className="al-card" style={{ padding: 20 }}>
        <GestaoClassificacoes
          classificacoes={classificacoes}
          nomesPorNif={nomesPorNif}
          centros={centros}
          casas={casasConfig}
        />
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

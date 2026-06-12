import Link from "next/link";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { FormularioCasa } from "@/components/FormularioCasa";

export const metadata = { title: "Nova casa · Sopro" };

export default async function NovaCasaPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <Link href="/casas" className="al-back">
          ← Casas
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: centrosData } = await supabase
    .from("centros_custo")
    .select("id, nome")
    .order("ordem");
  const centros = (centrosData ?? []) as { id: string; nome: string }[];

  return (
    <div>
      <Link href="/casas" className="al-back">
        ← Casas
      </Link>
      <div className="al-head">
        <h1>Nova casa</h1>
      </div>
      <div className="al-card" style={{ padding: 20 }}>
        <FormularioCasa centros={centros} modo="criar" />
      </div>
    </div>
  );
}

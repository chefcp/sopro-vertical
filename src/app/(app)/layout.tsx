import { redirect } from "next/navigation";
import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await getSessaoOrg();
  if (!sessao) redirect("/login");

  let orgNome: string | null = null;
  if (sessao.orgId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizacoes")
      .select("nome")
      .eq("id", sessao.orgId)
      .maybeSingle();
    orgNome = data?.nome ?? null;
  }

  return (
    <div>
      <TopBar orgNome={orgNome} email={sessao.email} />
      <Tabs />
      <main className="al-wrap">{children}</main>
    </div>
  );
}

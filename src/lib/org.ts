import { createClient } from "@/lib/supabase/server";

export interface SessaoOrg {
  userId: string;
  email: string | null;
  orgId: string | null;
}

/**
 * Resolve o utilizador autenticado e o seu org_id (via tabela membros).
 * A RLS isola por organização: sem org, o utilizador não vê dados.
 * Devolve null se não houver sessão.
 */
export async function getSessaoOrg(): Promise<SessaoOrg | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membro } = await supabase
    .from("membros")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    orgId: membro?.org_id ?? null,
  };
}

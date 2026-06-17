import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessaoOrg } from "@/lib/org";
import { envToconline, trocarCodigo } from "@/lib/toconline";

// O TOConline redireciona para aqui com ?code=... depois de o utilizador autorizar.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const erro = url.searchParams.get("error");
  const erroDesc = url.searchParams.get("error_description");
  const destino = (estado: string, detalhe?: string) => {
    const u = new URL(`/config?toc=${estado}`, url.origin);
    if (detalhe) u.searchParams.set("msg", detalhe.slice(0, 300));
    return NextResponse.redirect(u);
  };

  if (erro) return destino("erro", erroDesc ? `${erro}: ${erroDesc}` : erro);
  if (!code) return destino("sem_codigo");

  const env = envToconline();
  if (!env) return destino("sem_config");

  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    // Sem sessão não dá para guardar — manda para o login.
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  try {
    const tokens = await trocarCodigo(env, code);
    const supabase = await createClient();
    const agora = new Date().toISOString();
    const expira = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
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
    if (error) return destino("erro", error.message);
  } catch (e) {
    return destino("erro", e instanceof Error ? e.message : "falha desconhecida");
  }

  return destino("ok");
}

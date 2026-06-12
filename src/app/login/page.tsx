import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Sopro" };

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/cc");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div
          className="al-brand"
          style={{ justifyContent: "center", marginBottom: 24 }}
        >
          <span className="al-dot">SV</span>
          Sopro Vertical <small>· Alojamento Local</small>
        </div>
        <div className="al-card" style={{ padding: 24 }}>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

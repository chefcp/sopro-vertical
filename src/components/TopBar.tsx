import { signOut } from "@/lib/actions/auth";

/** Barra de topo: marca + organização + sair. */
export function TopBar({
  orgNome,
  email,
}: {
  orgNome: string | null;
  email: string | null;
}) {
  return (
    <div className="al-topbar">
      <div className="al-brand">
        <span className="al-dot">SV</span>
        Sopro Vertical <small>· Alojamento Local</small>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="al-org">{orgNome ?? "Sem organização"}</span>
        {email && (
          <span className="al-mono" title={email}>
            {email}
          </span>
        )}
        <form action={signOut}>
          <button type="submit" className="al-back" style={{ padding: 0 }}>
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

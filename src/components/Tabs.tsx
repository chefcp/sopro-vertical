"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/cc", label: "Centros de custo" },
  { href: "/casas", label: "Casas" },
  { href: "/reservas", label: "Reservas" },
  { href: "/custos", label: "Custos" },
  { href: "/lancamentos", label: "Lançamentos" },
  { href: "/documentos", label: "Documentos" },
  { href: "/config", label: "Configuração" },
];

export function Tabs() {
  const pathname = usePathname();
  return (
    <nav className="al-tabs">
      {ABAS.map((aba) => {
        const on =
          pathname === aba.href || pathname.startsWith(aba.href + "/");
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={`al-tab ${on ? "on" : ""}`}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}

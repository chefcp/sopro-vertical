"use client";

import { useRouter } from "next/navigation";

/** Linha de tabela clicável (e acessível por teclado) que navega para `href`. */
export function LinhaClicavel({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
    >
      {children}
    </tr>
  );
}

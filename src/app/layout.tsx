import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sopro · Alojamento Local",
  description: "Gestão de alojamento local",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}

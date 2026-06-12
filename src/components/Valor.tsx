import { eur } from "@/lib/format";

/**
 * Mostra um valor monetário. Negativos a vermelho; positivos "forte" a verde.
 * `dim` esbate (ex.: zeros). `alarme` adiciona uma dica em saldos negativos
 * que representam dívida (tesouraria/suprimentos negativos).
 */
export function Valor({
  n,
  forte = false,
  dim = false,
  alarme,
}: {
  n: number;
  forte?: boolean;
  dim?: boolean;
  alarme?: string;
}) {
  const cls = n < 0 ? "al-neg" : forte ? "al-pos" : "";
  const title = n < 0 && alarme ? alarme : undefined;
  return (
    <span
      className={`al-num ${cls} ${dim ? "al-dim" : ""} ${
        title ? "al-alarme" : ""
      }`}
      title={title}
    >
      {eur(n)}
    </span>
  );
}

/** Valor de IVA, sempre destacado a azul. */
export function ValorIva({ n }: { n: number }) {
  return <span className="al-num al-iva">{eur(n)}</span>;
}

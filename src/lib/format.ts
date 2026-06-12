const eurFmt = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

/** Formata um valor em euros no formato pt-PT (ex.: 1 234,50 €). */
export function eur(n: number | null | undefined): string {
  return eurFmt.format(n ?? 0);
}

const dataFmt = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Formata uma data ISO (YYYY-MM-DD) no formato pt-PT (dd/mm/aaaa). */
export function dataPt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return dataFmt.format(d);
}

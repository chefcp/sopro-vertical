/**
 * Parser do QR-Code fiscal português (Portaria 195/2020).
 * O conteúdo do QR é uma lista de campos `CHAVE:valor` separados por `*`.
 * Campos relevantes para um custo:
 *   A  = NIF do emitente (fornecedor)
 *   D  = tipo de documento (FT, FR, FS, NC, ND…)
 *   F  = data do documento (AAAAMMDD)
 *   G  = nº do documento
 *   I2/I3/I5/I7 = bases (isenta/reduzida/intermédia/normal)
 *   I4/I6/I8    = IVA por taxa
 *   N  = total de IVA
 *   O  = total com impostos
 * Puro (sem DOM) — pode correr no cliente ou no servidor.
 */

export type FaturaQr = {
  nif: string; // A — NIF do emitente (fornecedor)
  nifAdquirente: string; // B — NIF do adquirente (deve ser a Sopro)
  atcud: string; // H — código único do documento (deteta repetidas)
  tipoDoc: string;
  data: string | null; // YYYY-MM-DD
  numero: string;
  valorBase: number;
  iva: number;
  total: number;
};

const arred2 = (n: number) => Math.round(n * 100) / 100;

function parseNum(v: string | undefined): number {
  if (!v) return NaN;
  // O QR fiscal usa ponto decimal; tolera-se vírgula por segurança.
  return Number(v.replace(",", "."));
}

function dataDeF(f: string | undefined): string | null {
  if (!f || !/^\d{8}$/.test(f)) return null;
  return `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`;
}

/** Diz se um texto parece um QR fiscal (tem campos A: e o separador *). */
export function ehQrFiscal(texto: string): boolean {
  return /(^|\*)A:\s*\d/.test(texto) && /(^|\*)[FGO]\d*:/.test(texto);
}

/** Converte o conteúdo de um QR fiscal nos campos de um custo. */
export function parseFaturaQr(texto: string): FaturaQr | null {
  if (!texto || !texto.includes(":")) return null;
  const campos: Record<string, string> = {};
  for (const parte of texto.split("*")) {
    const i = parte.indexOf(":");
    if (i <= 0) continue;
    campos[parte.slice(0, i).trim()] = parte.slice(i + 1).trim();
  }
  if (!campos.A) return null;

  const total = parseNum(campos.O);
  const ivaN = parseNum(campos.N);

  // Bases e IVA por taxa, somados (para o caso de N/O virem em falta).
  const somaBases =
    (parseNum(campos.I2) || 0) +
    (parseNum(campos.I3) || 0) +
    (parseNum(campos.I5) || 0) +
    (parseNum(campos.I7) || 0);
  const somaIva =
    (parseNum(campos.I4) || 0) +
    (parseNum(campos.I6) || 0) +
    (parseNum(campos.I8) || 0);

  let valorBase: number;
  let iva: number;
  let valorTotal: number;

  if (Number.isFinite(total)) {
    valorTotal = total;
    iva = Number.isFinite(ivaN) ? ivaN : somaIva;
    // base = total − IVA garante que `total` gerado (base+iva) reconcilia.
    valorBase = arred2(valorTotal - iva);
  } else {
    valorBase = somaBases;
    iva = Number.isFinite(ivaN) ? ivaN : somaIva;
    valorTotal = arred2(valorBase + iva);
  }

  if (!Number.isFinite(valorBase) || valorBase < 0) return null;
  if (!Number.isFinite(iva) || iva < 0) iva = 0;

  return {
    nif: campos.A,
    nifAdquirente: campos.B ?? "",
    atcud: campos.H ?? "",
    tipoDoc: campos.D ?? "",
    data: dataDeF(campos.F),
    numero: campos.G ?? "",
    valorBase: arred2(valorBase),
    iva: arred2(iva),
    total: arred2(valorTotal),
  };
}

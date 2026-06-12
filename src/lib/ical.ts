/**
 * Parser mínimo de iCalendar (RFC 5545) — o suficiente para os exports
 * de Airbnb/VRBO: extrai VEVENTs com UID, datas, resumo e descrição.
 * Sem dependências externas.
 */

export interface EventoIcal {
  uid: string;
  inicio: string | null; // YYYY-MM-DD (DTSTART)
  fim: string | null; // YYYY-MM-DD (DTEND, exclusivo = check-out)
  resumo: string;
  descricao: string;
}

/** Desdobra linhas dobradas (continuação começa com espaço ou tab). */
function desdobrar(texto: string): string[] {
  const linhas = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const linha of linhas) {
    if ((linha.startsWith(" ") || linha.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += linha.slice(1);
    } else {
      out.push(linha);
    }
  }
  return out;
}

/** Converte um valor de data iCal (YYYYMMDD ou YYYYMMDDTHHMMSSZ) em YYYY-MM-DD. */
function parseData(valor: string): string | null {
  const m = valor.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseIcs(texto: string): EventoIcal[] {
  const linhas = desdobrar(texto);
  const eventos: EventoIcal[] = [];
  let atual: Partial<EventoIcal> | null = null;

  for (const linha of linhas) {
    if (linha === "BEGIN:VEVENT") {
      atual = { uid: "", inicio: null, fim: null, resumo: "", descricao: "" };
      continue;
    }
    if (linha === "END:VEVENT") {
      if (atual && atual.uid) {
        eventos.push({
          uid: atual.uid,
          inicio: atual.inicio ?? null,
          fim: atual.fim ?? null,
          resumo: atual.resumo ?? "",
          descricao: atual.descricao ?? "",
        });
      }
      atual = null;
      continue;
    }
    if (!atual) continue;

    const sep = linha.indexOf(":");
    if (sep === -1) continue;
    const nome = linha.slice(0, sep).split(";")[0].toUpperCase();
    const valor = linha.slice(sep + 1).trim();

    if (nome === "UID") atual.uid = valor;
    else if (nome === "DTSTART") atual.inicio = parseData(valor);
    else if (nome === "DTEND") atual.fim = parseData(valor);
    else if (nome === "SUMMARY") atual.resumo = valor;
    else if (nome === "DESCRIPTION")
      atual.descricao = valor.replace(/\\n/g, " ").replace(/\\,/g, ",");
  }

  return eventos;
}

const GENERICOS =
  /reserved|not available|unavailable|blocked|bloqueado|indispon|closed|airbnb|vrbo|booking/i;

/** O evento representa um bloqueio (indisponibilidade), não uma reserva. */
export function ehBloqueio(resumo: string): boolean {
  return /not available|unavailable|blocked|bloqueado|indispon|closed/i.test(
    resumo,
  );
}

/**
 * Tenta extrair o nome do hóspede a partir do SUMMARY/DESCRIPTION.
 * Airbnb costuma só dizer "Reserved" (sem nome) -> devolve null nesse caso;
 * o VRBO/Booking por vezes traz o nome no SUMMARY.
 */
export function nomeHospede(resumo: string, descricao: string): string | null {
  const candidatos = [resumo, descricao];
  for (const bruto of candidatos) {
    if (!bruto) continue;
    // Remove URLs, rótulos ("Reservation URL: ...") e números (telefones).
    const limpo = bruto
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\b\w+:\s*/g, " ")
      .replace(/[0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!limpo || GENERICOS.test(limpo)) continue;
    return limpo.slice(0, 80);
  }
  return null;
}

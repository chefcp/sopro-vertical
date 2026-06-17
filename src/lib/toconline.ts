// Integração TOConline — só servidor (usa client_secret). OAuth2 authorization_code.
// Doc: https://api-docs.toconline.pt/autenticacao-detalhada.md
import "server-only";

type Env = {
  clientId: string;
  clientSecret: string;
  oauthUrl: string;
  apiUrl: string;
  redirectUrl: string;
};

export function envToconline(): Env | null {
  const clientId = process.env.TOCONLINE_CLIENT_ID;
  const clientSecret = process.env.TOCONLINE_CLIENT_SECRET;
  const oauthUrl = process.env.TOCONLINE_OAUTH_URL;
  const apiUrl = process.env.TOCONLINE_API_URL;
  const redirectUrl = process.env.TOCONLINE_REDIRECT_URL;
  if (!clientId || !clientSecret || !oauthUrl || !apiUrl || !redirectUrl) return null;
  return {
    clientId,
    clientSecret,
    oauthUrl: oauthUrl.replace(/\/$/, ""),
    apiUrl: apiUrl.replace(/\/$/, ""),
    redirectUrl,
  };
}

/** URL para o utilizador autorizar (abre no browser; devolve o código ao redirect). */
export function urlAutorizacao(env: Env): string {
  const p = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUrl,
    response_type: "code",
    scope: "commercial",
  });
  return `${env.oauthUrl}/auth?${p.toString()}`;
}

export type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // segundos
};

function basic(env: Env): string {
  const b64 = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  return `Basic ${b64}`;
}

async function pedirToken(env: Env, body: URLSearchParams): Promise<Tokens> {
  const res = await fetch(`${env.oauthUrl}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: basic(env),
    },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`TOConline token ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as Partial<Tokens>;
  if (!j.access_token || !j.refresh_token) {
    throw new Error("Resposta de token do TOConline sem access/refresh.");
  }
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_in: Number(j.expires_in ?? 14400),
  };
}

/** Troca o código de autorização (colado pelo utilizador) por tokens. */
export function trocarCodigo(env: Env, code: string): Promise<Tokens> {
  return pedirToken(
    env,
    new URLSearchParams({
      grant_type: "authorization_code",
      code: code.trim(),
      redirect_uri: env.redirectUrl,
      scope: "commercial",
    }),
  );
}

/** Renova o access_token a partir do refresh_token (devolve também novo refresh). */
export function renovarToken(env: Env, refresh: string): Promise<Tokens> {
  return pedirToken(
    env,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      scope: "commercial",
    }),
  );
}

// ---- Leitura de documentos de compra ----

export type DocCompra = {
  toconline_id: string;
  numero: string;
  data: string; // AAAA-MM-DD
  valor_base: number;
  iva: number;
  total: number;
  fornecedor_nome: string;
  fornecedor_nif: string;
  tipo: string; // FC | DSP
};

type JsonApiObj = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id?: string; type?: string } }>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Constrói o mapa de fornecedores a partir dos objetos `included` (JSON:API). */
function mapaFornecedores(
  included: JsonApiObj[],
): Map<string, { nome: string; nif: string }> {
  const m = new Map<string, { nome: string; nif: string }>();
  for (const o of included) {
    if (!o.id || o.type !== "suppliers") continue;
    const a = o.attributes ?? {};
    const nome = String(
      a.business_name ?? a.name ?? a.company_name ?? a.contact_name ?? "",
    );
    const nif = String(
      a.tax_registration_number ?? a.tax_number ?? a.vat_number ?? "",
    );
    m.set(o.id, { nome, nif });
  }
  return m;
}

function mapearDoc(
  d: JsonApiObj,
  fornecedores: Map<string, { nome: string; nif: string }>,
): DocCompra | null {
  // Pode vir como objeto JSON:API ({id, attributes}) ou plano (campos diretos).
  const a = (d.attributes ?? (d as unknown as Record<string, unknown>)) ?? {};
  const idBruto = d.id ?? (a as Record<string, unknown>).id;
  if (idBruto == null) return null;
  const id = String(idBruto);
  const base = num(a.net_total);
  const total = num(a.gross_total);
  // IVA = total − base (caso típico; o utilizador confere na revisão).
  const iva = Math.round((total - base) * 100) / 100;

  // Fornecedor: ou nos atributos, ou via relationship → included.
  let nome = String(a.supplier_business_name ?? a.supplier_name ?? "");
  let nif = String(a.supplier_tax_registration_number ?? "");
  if (!nif || !nome) {
    const rel = d.relationships ?? ({} as NonNullable<JsonApiObj["relationships"]>);
    for (const k of Object.keys(rel)) {
      const ref = rel[k]?.data;
      if (ref?.type === "suppliers" && ref.id && fornecedores.has(ref.id)) {
        const f = fornecedores.get(ref.id)!;
        nome = nome || f.nome;
        nif = nif || f.nif;
        break;
      }
    }
  }

  return {
    toconline_id: id,
    numero: String(a.document_no ?? ""),
    data: String(a.date ?? "").slice(0, 10),
    valor_base: base,
    iva,
    total,
    fornecedor_nome: nome,
    fornecedor_nif: nif,
    tipo: String(a.document_type ?? ""),
  };
}

/**
 * Lê documentos de compra finalizados (paginado via `links.next`). Devolve também
 * uma amostra crua do 1º documento (para diagnóstico do mapeamento).
 */
export async function listarDocumentosCompra(
  env: Env,
  accessToken: string,
  opts: { pageSize?: number; maxPaginas?: number } = {},
): Promise<{ docs: DocCompra[]; amostra: unknown | null }> {
  const pageSize = opts.pageSize ?? 100;
  const maxPaginas = opts.maxPaginas ?? 20;
  const out: DocCompra[] = [];
  let amostra: unknown | null = null;

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const p = new URLSearchParams();
    p.set("filter[status]", "1"); // finalizados
    p.set("page[size]", String(pageSize));
    p.set("page[number]", String(pagina));
    const url = `${env.apiUrl}/api/v1/commercial_purchases_documents?${p.toString()}`;

    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (res.status === 401) throw new Error("TOConline 401: token inválido/expirado.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`TOConline GET ${res.status}: ${txt.slice(0, 200)}`);
    }
    const j = (await res.json()) as unknown;

    // A resposta pode ser um array simples OU um objeto JSON:API {data,included}.
    const obj = (j ?? {}) as { data?: JsonApiObj[]; included?: JsonApiObj[] };
    const data: JsonApiObj[] = Array.isArray(j) ? (j as JsonApiObj[]) : (obj.data ?? []);
    const included: JsonApiObj[] = Array.isArray(j) ? [] : (obj.included ?? []);

    if (pagina === 1) {
      amostra = { formato: Array.isArray(j) ? "array" : "objeto", n: data.length, primeiro: data[0] ?? null };
    }

    if (data.length === 0) break;
    const fornecedores = mapaFornecedores(included);
    for (const d of data) {
      const m = mapearDoc(d, fornecedores);
      if (m) out.push(m);
    }
    if (data.length < pageSize) break; // última página
  }
  return { docs: out, amostra };
}

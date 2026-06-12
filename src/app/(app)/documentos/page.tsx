import { getSessaoOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { UploadDocumento } from "@/components/UploadDocumento";
import { apagarDocumentoAction } from "@/lib/actions/documentos";
import { dataPt } from "@/lib/format";

export const metadata = { title: "Documentos · Sopro" };

const TIPO_LABEL: Record<string, string> = {
  reserva: "Reserva",
  custo: "Custo",
  suprimento: "Suprimento",
};

export default async function DocumentosPage() {
  const sessao = await getSessaoOrg();
  if (!sessao?.orgId) {
    return (
      <div>
        <div className="al-head">
          <h1>Documentos</h1>
        </div>
        <div className="al-card" style={{ padding: 24 }}>
          <p className="al-hint" style={{ margin: 0 }}>
            Sem organização associada.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: docsData }, { data: reservasData }, { data: casasData }, { data: custosData }] =
    await Promise.all([
      supabase
        .from("documentos")
        .select("id, entidade_tipo, entidade_id, storage_path, nome_ficheiro, criado_em")
        .order("criado_em", { ascending: false }),
      supabase.from("reservas").select("id, casa_id, canal, data_checkin"),
      supabase.from("casas").select("id, nome"),
      supabase.from("custos").select("id, fornecedor, data"),
    ]);

  const docs = (docsData ?? []) as {
    id: string;
    entidade_tipo: string;
    entidade_id: string;
    storage_path: string;
    nome_ficheiro: string | null;
    criado_em: string;
  }[];

  const casaNome = new Map(
    ((casasData ?? []) as { id: string; nome: string }[]).map((c) => [c.id, c.nome]),
  );
  const reservas = ((reservasData ?? []) as {
    id: string;
    casa_id: string;
    canal: string | null;
    data_checkin: string | null;
  }[]).map((r) => ({
    id: r.id,
    label: `${casaNome.get(r.casa_id) ?? "—"} · ${dataPt(r.data_checkin)}`,
  }));
  const custos = ((custosData ?? []) as {
    id: string;
    fornecedor: string;
    data: string;
  }[]).map((c) => ({ id: c.id, label: `${c.fornecedor} · ${dataPt(c.data)}` }));

  const reservaLabel = new Map(reservas.map((r) => [r.id, r.label]));
  const custoLabel = new Map(custos.map((c) => [c.id, c.label]));

  // URLs assinados (bucket privado), válidos 1h.
  let urls = new Map<string, string>();
  if (docs.length > 0) {
    const { data: assinados } = await supabase.storage
      .from("documentos")
      .createSignedUrls(
        docs.map((d) => d.storage_path),
        3600,
      );
    for (const a of assinados ?? []) {
      if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
    }
  }

  const refDe = (d: (typeof docs)[number]) => {
    if (d.entidade_tipo === "reserva")
      return reservaLabel.get(d.entidade_id) ?? "Reserva";
    if (d.entidade_tipo === "custo")
      return custoLabel.get(d.entidade_id) ?? "Custo";
    return "—";
  };

  return (
    <div>
      <div className="al-head">
        <h1>Documentos</h1>
      </div>

      <UploadDocumento reservas={reservas} custos={custos} />

      <div className="al-card">
        <table className="al-table">
          <thead>
            <tr>
              <th>Ficheiro</th>
              <th>Tipo</th>
              <th>Refere-se a</th>
              <th>Data</th>
              <th className="al-c">Ações</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const url = urls.get(d.storage_path);
              return (
                <tr key={d.id}>
                  <td>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--iva)", textDecoration: "none" }}
                      >
                        {d.nome_ficheiro ?? "documento"}
                      </a>
                    ) : (
                      (d.nome_ficheiro ?? "documento")
                    )}
                  </td>
                  <td>
                    <span className="al-tag" style={{ marginLeft: 0 }}>
                      {TIPO_LABEL[d.entidade_tipo] ?? d.entidade_tipo}
                    </span>
                  </td>
                  <td className="al-dim">{refDe(d)}</td>
                  <td className="al-mono">{dataPt(d.criado_em.slice(0, 10))}</td>
                  <td className="al-c">
                    <form action={apagarDocumentoAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="path" value={d.storage_path} />
                      <button type="submit" className="al-back" style={{ padding: 0 }}>
                        Apagar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="al-hint" style={{ padding: 24 }}>
                  Ainda não há documentos. Carrega um acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="al-hint">
        Os ficheiros ficam num bucket privado; as ligações de acesso são
        temporárias (1 hora).
      </p>
    </div>
  );
}

/**
 * Leitura do QR-Code de uma fatura no browser — sem servidor, sem chaves.
 * Imagens: desenha num canvas e corre o jsQR.
 * PDF: renderiza cada página com o pdf.js e corre o jsQR sobre o canvas.
 * Tudo importado dinamicamente para não correr no servidor (SSR).
 */

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts?: { inversionAttempts?: string },
) => { data: string } | null;

let jsQrCache: JsQrFn | null = null;
async function getJsQr(): Promise<JsQrFn> {
  if (!jsQrCache) {
    const mod = await import("jsqr");
    jsQrCache = (mod.default ?? mod) as JsQrFn;
  }
  return jsQrCache;
}

function scanCanvas(
  jsQR: JsQrFn,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): string | null {
  const img = ctx.getImageData(0, 0, w, h);
  const res = jsQR(img.data, img.width, img.height, {
    inversionAttempts: "attemptBoth",
  });
  return res?.data ?? null;
}

async function lerImagem(file: File): Promise<string | null> {
  const jsQR = await getJsQr();
  const bitmap = await createImageBitmap(file);
  // Limita a dimensão para não rebentar memória em fotos enormes.
  const max = 2000;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return scanCanvas(jsQR, ctx, w, h);
}

async function lerPdf(file: File): Promise<string | null> {
  const jsQR = await getJsQr();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buf = await file.arrayBuffer();
  // wasmUrl é OBRIGATÓRIO no browser para descodificar JBIG2/JPEG2000 — muitas
  // faturas digitalizadas têm o QR nessa camada; sem isto, fica em branco.
  const doc = await pdfjs.getDocument({
    data: buf,
    wasmUrl: "/pdfjs/wasm/",
  }).promise;
  try {
    const maxPaginas = Math.min(doc.numPages, 5);
    for (let p = 1; p <= maxPaginas; p++) {
      const page = await doc.getPage(p);
      // O QR fiscal é pequeno; tenta-se em duas escalas (a 2ª, maior, ajuda
      // em digitalizações de menor qualidade).
      for (const escala of [3, 4.5]) {
        const viewport = page.getViewport({ scale: escala });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;
        await page.render({ canvas, viewport }).promise;
        const r = scanCanvas(jsQR, ctx, canvas.width, canvas.height);
        if (r) {
          page.cleanup();
          return r;
        }
      }
      page.cleanup();
    }
    return null;
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** Lê o conteúdo do QR de uma fatura (PDF ou imagem). null se não encontrar. */
export async function lerQrDeFicheiro(file: File): Promise<string | null> {
  const ehPdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  try {
    return ehPdf ? await lerPdf(file) : await lerImagem(file);
  } catch {
    return null;
  }
}

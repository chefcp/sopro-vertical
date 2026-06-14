/**
 * Leitura do QR-Code de uma fatura no browser — sem servidor, sem chaves.
 * Descodificador: ZXing (zxing-wasm) — robusto em fotos/digitalizações reais.
 * Imagens: o ZXing lê o ficheiro diretamente.
 * PDF: o pdf.js renderiza cada página num canvas (com WASM local para a camada
 * JBIG2/JPEG2000 das faturas digitalizadas) e o ZXing lê a imagem.
 * WASM do ZXing e worker do pdf.js servidos de `/public` (sem CDN).
 */

let zxingConfigurado = false;
async function getReadBarcodes() {
  const mod = await import("zxing-wasm/reader");
  if (!zxingConfigurado) {
    mod.setZXingModuleOverrides({
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : prefix + path,
    });
    zxingConfigurado = true;
  }
  return mod.readBarcodes;
}

async function lerCodigo(input: Blob | ImageData): Promise<string | null> {
  const readBarcodes = await getReadBarcodes();
  const res = await readBarcodes(input, {
    formats: ["QRCode"],
    tryHarder: true,
    maxNumberOfSymbols: 1,
  });
  const t = res.find((r) => r.text)?.text;
  return t || null;
}

async function lerImagem(file: File): Promise<string | null> {
  // O ZXing descodifica a imagem diretamente (lida com rotação/contraste).
  return lerCodigo(file);
}

async function lerPdf(file: File): Promise<string | null> {
  const pdfjs = await import("pdfjs-dist");
  // Worker e WASM servidos localmente (evita incertezas do empacotador/CDN).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({
    data: buf,
    wasmUrl: "/pdfjs/wasm/",
  }).promise;
  try {
    const maxPaginas = Math.min(doc.numPages, 5);
    for (let p = 1; p <= maxPaginas; p++) {
      const page = await doc.getPage(p);
      // O QR fiscal é pequeno; tenta-se em duas escalas.
      for (const escala of [3, 4.5]) {
        const viewport = page.getViewport({ scale: escala });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;
        await page.render({ canvas, viewport }).promise;
        const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const r = await lerCodigo(im);
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

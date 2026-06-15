/**
 * pdf.ts -- lazy PDF to JPEG conversion for document upload.
 *
 * An identity document must reach the server as a raster image: the dashboard
 * renders it with an <img> and face matching only accepts JPEG/PNG. If a
 * subject picks a PDF we render its first page to a JPEG before upload so the
 * rest of the pipeline only ever sees an image.
 *
 * The SDK ships zero runtime dependencies, so pdfjs is loaded from a CDN on
 * demand the first time a PDF is selected. If the load or render fails the
 * caller surfaces a clear "upload a photo instead" message.
 */

const PDFJS_VERSION = '4.10.38';
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // Non-literal URL so bundlers leave this as a runtime import.
      const url = `${PDFJS_BASE}/pdf.min.mjs`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import(/* @vite-ignore */ /* webpackIgnore: true */ url);
      const lib = mod.default ?? mod;
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return lib;
    })();
  }
  return pdfjsPromise;
}

/** True if the picked file looks like a PDF (by MIME or extension). */
export function isPdf(file: { type?: string; name?: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? '');
}

/**
 * Render the first page of a PDF to a base64 JPEG string (no `data:` prefix,
 * matching the upload payload shape). Throws if the PDF can't be parsed or
 * rendered.
 */
export async function pdfFirstPageToJpegBase64(data: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const longEdge = Math.max(base.width, base.height) || 1;
    // Aim for a ~2000px long edge: legible for OCR and Rekognition, small as a JPEG.
    const scale = Math.min(4, Math.max(1, 2000 / longEdge));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    // Flatten transparency onto white so scans are not rendered black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1] ?? '';
  } finally {
    void pdf.destroy();
  }
}

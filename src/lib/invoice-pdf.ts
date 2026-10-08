// Turns the on-screen invoice (#invoice) into a real PDF file in the browser, so it can be
// sent on WhatsApp as a document instead of a link. The invoice is drawn at a fixed width
// (whatever the screen size), photographed, and placed on A4 pages.

const A4_W = 595.28, A4_H = 841.89, MARGIN = 24; // PDF points
const RENDER_WIDTH = 820; // px the invoice is laid out at before it is photographed

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not draw the invoice.");
  return new Uint8Array(await blob.arrayBuffer());
}

type Page = { jpeg: Uint8Array; wPx: number; hPx: number; wPt: number; hPt: number };

// Minimal PDF writer: one JPEG per A4 page.
function pdfFromPages(pages: Page[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (d: string | Uint8Array) => { const b = typeof d === "string" ? enc.encode(d) : d; chunks.push(b); pos += b.length; };
  const begin = (n: number) => { offsets[n] = pos; push(`${n} 0 obj\n`); };
  const total = 2 + pages.length * 3;
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // marks the file as binary
  begin(1); push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  begin(2); push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>\nendobj\n`);
  pages.forEach((p, i) => {
    const page = 3 + i * 3, img = page + 1, content = page + 2;
    begin(page);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>\nendobj\n`);
    begin(img);
    push(`<< /Type /XObject /Subtype /Image /Width ${p.wPx} /Height ${p.hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    push("\nendstream\nendobj\n");
    const draw = `q ${p.wPt.toFixed(2)} 0 0 ${p.hPt.toFixed(2)} ${MARGIN} ${(A4_H - MARGIN - p.hPt).toFixed(2)} cm /Im0 Do Q`;
    begin(content);
    push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream\nendobj\n`);
  });
  const xref = pos;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

export async function buildInvoicePdf(node: HTMLElement): Promise<Blob> {
  const { toCanvas } = await import("html-to-image");
  // Wait until the logo / signature pictures have loaded — an invoice drawn a moment ago may
  // still be fetching them, and a picture that has not loaded yet would be missing from the PDF.
  await Promise.all(Array.from(node.querySelectorAll("img")).map((img) => (img.complete && img.naturalWidth > 0 ? null : new Promise<void>((res) => {
    const done = () => res();
    img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true });
    setTimeout(done, 8000); // never hang on a broken picture
  }))));
  // A copy of the invoice laid out at a fixed width, off-screen, so the PDF looks the same
  // from a phone and from a wide monitor.
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${RENDER_WIDTH}px;background:#ffffff;z-index:-1;`;
  const copy = node.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.style.boxShadow = "none";
  holder.appendChild(copy);
  document.body.appendChild(holder);
  try {
    const canvas = await toCanvas(copy, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: false });
    const wPt = A4_W - MARGIN * 2;
    const scale = wPt / canvas.width; // points per canvas pixel
    const pagePx = Math.floor((A4_H - MARGIN * 2) / scale); // canvas pixels that fit on one page
    const pages: Page[] = [];
    for (let y = 0; y < canvas.height; y += pagePx) {
      const h = Math.min(pagePx, canvas.height - y);
      if (h < 4 && pages.length) break; // ignore a sliver left over by rounding
      const slice = document.createElement("canvas");
      slice.width = canvas.width; slice.height = h;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("Could not draw the invoice.");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      pages.push({ jpeg: await canvasToJpeg(slice), wPx: slice.width, hPx: h, wPt, hPt: h * scale });
    }
    return pdfFromPages(pages);
  } finally {
    holder.remove();
  }
}

// "Good morning" / "Good afternoon" / "Good evening" by the clock on this computer / phone.
export function greetingForNow(now = new Date()): string {
  const h = now.getHours();
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening";
}

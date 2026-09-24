import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

// Serves files saved to public/uploads at runtime (Server Action uploads) reliably,
// even if the static handler doesn't pick up files added after build.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  // prevent path traversal
  const safe = parts.filter((p) => p && p !== ".." && !p.includes("/") && !p.includes("\\"));
  if (safe.length === 0) return new Response("Not found", { status: 404 });
  const filePath = path.join(process.cwd(), "public", "uploads", ...safe);
  try {
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "private, max-age=3600", "Content-Disposition": `inline; filename="${safe[safe.length - 1]}"` },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

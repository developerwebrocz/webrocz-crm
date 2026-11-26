import "server-only";
import { prisma } from "./prisma";

// "Upload SLA" in a client's Edit info (accountants only): the signed SLA file is saved under
// /public/uploads/slas and added to the client's SLAs, so it shows on the client page and in the
// SLA column of the client lists. A client that already has an invoice gets it as "Invoiced"
// (it is the agreement for work already billed), otherwise "To invoice".
export async function attachClientSla(fd: FormData, clientId: string, clientName: string, by: string): Promise<void> {
  const file = fd.get("slaFile");
  if (!file || typeof file === "string") return;
  const f = file as File;
  if (!f.size || !f.arrayBuffer) return;
  const { writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const safe = (f.name || "sla").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const fname = `${Date.now()}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads", "slas");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), Buffer.from(await f.arrayBuffer()));
  const billed = await prisma.salesInvoice.count({ where: { clientId } });
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { pocName: true, pocMobile: true, pocEmail: true, gstin: true } });
  await prisma.sla.create({
    data: {
      clientName, clientId,
      title: String(fd.get("slaTitle") ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || "Service agreement",
      pocName: client?.pocName ?? "", pocMobile: client?.pocMobile ?? "", pocEmail: client?.pocEmail ?? "", gstin: client?.gstin ?? "",
      fileUrl: `/uploads/slas/${fname}`, uploadedBy: by, status: billed > 0 ? "INVOICED" : "UPLOADED",
    },
  });
}

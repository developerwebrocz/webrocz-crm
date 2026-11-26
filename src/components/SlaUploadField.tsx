import { FileSignature } from "lucide-react";

// "Upload SLA" inside a client's Edit info — shown to the accountants only. The file is saved
// with the client's other changes (Save) and added to the client's SLAs.
export default function SlaUploadField() {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--line-2)] bg-[var(--surface-2)] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-2)]"><FileSignature size={14} className="text-[var(--violet)]" /> Upload SLA <span className="font-normal text-[var(--muted)]">· optional</span></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="slaTitle" maxLength={120} placeholder="SLA title, e.g. Digital marketing SLA 2026" className="input" />
        <input name="slaFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input !py-2 text-[12.5px]" />
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--faint)]">PDF, image or Word file. It shows on the client page and in the SLA column after Save.</p>
    </div>
  );
}

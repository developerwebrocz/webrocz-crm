import { companyLabel } from "@/lib/domain";
import { Globe, Megaphone, Building2 } from "lucide-react";

const ICON: Record<string, React.ElementType> = { WEB_SOLUTIONS: Globe, WEB_ROCZ: Megaphone, WEB_ROCZ_PVT: Building2 };

// Company header shown atop each scoped page (Clients / Invoices / Website renewals).
// The sidebar's expandable Companies group provides the section navigation, so no tabs here.
export default function CompanyNav({ company }: { company: string; active?: "clients" | "invoices" | "renewals" }) {
  const CompanyIcon = ICON[company] ?? Building2;
  const isGst = company === "WEB_ROCZ_PVT";
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--magenta), var(--violet))" }}><CompanyIcon size={16} /></span>
      <h1 className="text-[20px] font-extrabold tracking-tight">{companyLabel(company)}</h1>
      <span className="rounded-full border border-[var(--line-2)] bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--violet)]">{isGst ? "GST" : "No GST"}</span>
    </div>
  );
}

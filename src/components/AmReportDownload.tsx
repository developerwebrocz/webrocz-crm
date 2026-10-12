"use client";

import { Download } from "lucide-react";

// "Download report": the account manager's clients with this month's numbers as a sheet
// (opens in Excel / Google Sheets) — what they send or present as the monthly report.
type Row = { name: string; services: string[]; metaSpend: number; metaLeads: number; gSpend: number; gLeads: number; posts: number; creativeDone: number; creativeOpen: number; lastUpdate: string };

export default function AmReportDownload({ rows, monthLabel, manager }: { rows: Row[]; monthLabel: string; manager: string }) {
  const download = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const fmt = (d: string) => { const [y, m, dd] = d.split("-"); return dd ? `${dd}-${m}-${y}` : ""; };
    const head = ["Client", "Services", "Meta spend", "Meta leads", "Google spend", "Google leads", "Total spend", "Total leads", "Cost per lead", "Posts", "Designs / videos done", "Designs / videos open", "Last update"];
    const body = rows.map((r) => {
      const spend = r.metaSpend + r.gSpend, leads = r.metaLeads + r.gLeads;
      return [r.name, r.services.join(", "), r.metaSpend, r.metaLeads, r.gSpend, r.gLeads, spend, leads, leads ? Math.round(spend / leads) : "", r.posts, r.creativeDone, r.creativeOpen, fmt(r.lastUpdate)];
    });
    const t = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);
    const tSpend = t((r) => r.metaSpend + r.gSpend), tLeads = t((r) => r.metaLeads + r.gLeads);
    const total = ["Total", "", t((r) => r.metaSpend), t((r) => r.metaLeads), t((r) => r.gSpend), t((r) => r.gLeads), tSpend, tLeads, tLeads ? Math.round(tSpend / tLeads) : "", t((r) => r.posts), t((r) => r.creativeDone), t((r) => r.creativeOpen), ""];
    const csv = [[`Client report — ${monthLabel} — ${manager}`], [], head, ...body, total].map((r) => r.map(q).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `Client report - ${monthLabel} - ${manager}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return <button type="button" onClick={download} className="btn btn-ghost btn-sm"><Download size={14} /> Download report</button>;
}

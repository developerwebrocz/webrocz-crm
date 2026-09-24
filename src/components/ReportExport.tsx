"use client";

import { Download, Printer } from "lucide-react";

type Row = { date: string; client: string; workType: string; qty: number; status: string; user: string; detail: string };

export default function ReportExport({ rows, filename }: { rows: Row[]; filename: string }) {
  function downloadCSV() {
    const head = ["Date", "Client", "Work Type", "Qty", "Status", "User", "Detail"];
    const lines = [head.join(",")].concat(
      rows.map((r) =>
        [r.date, r.client, r.workType, r.qty, r.status, r.user, r.detail]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button onClick={downloadCSV} className="btn btn-ghost"><Download size={15} /> Download CSV</button>
      <button onClick={() => window.print()} className="btn btn-ghost"><Printer size={15} /> Print / PDF</button>
    </div>
  );
}

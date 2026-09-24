"use client";

import { Download } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ReportDownload({ sections, filename }: { sections: { title: string; head: string[]; rows: (string | number)[][] }[]; filename: string }) {
  const download = () => {
    const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];
    for (const s of sections) {
      lines.push(s.title);
      lines.push(s.head.map(esc).join(","));
      for (const r of s.rows) lines.push(r.map(esc).join(","));
      lines.push("");
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  return <button onClick={download} className="btn btn-violet"><Download size={15} /> Download report (CSV)</button>;
}

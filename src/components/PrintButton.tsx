"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-dark"><Printer size={15} /> Print / Download PDF</button>
  );
}

"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white"
    >
      <Printer size={15} strokeWidth={1.8} />
      Print / save as PDF
    </button>
  );
}

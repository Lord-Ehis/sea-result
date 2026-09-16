"use client";

import { X } from "lucide-react";
import type { GradeBand } from "./actions";

// Shared by the flat "grade" formula config and the Grid field's grade
// bands — extracted so both stay in sync rather than duplicating the list UI.
export function GradeBandsEditor({ bands, onChange }: { bands: GradeBand[]; onChange: (bands: GradeBand[]) => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[10px] text-text-muted">Grade bands</span>
      <div className="grid gap-1.5">
        {bands.map((band, i) => (
          <div key={i} className="grid grid-cols-[64px_64px_1fr_auto] items-center gap-1.5">
            <input
              type="number"
              value={band.min}
              onChange={(e) => {
                const next = [...bands];
                next[i] = { ...band, min: Number(e.target.value) };
                onChange(next);
              }}
              placeholder="Min"
              className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
            />
            <input
              type="number"
              value={band.max}
              onChange={(e) => {
                const next = [...bands];
                next[i] = { ...band, max: Number(e.target.value) };
                onChange(next);
              }}
              placeholder="Max"
              className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
            />
            <input
              value={band.label}
              onChange={(e) => {
                const next = [...bands];
                next[i] = { ...band, label: e.target.value };
                onChange(next);
              }}
              placeholder="Label (e.g. A)"
              className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
            />
            <button
              type="button"
              onClick={() => onChange(bands.filter((_, bi) => bi !== i))}
              aria-label={`Remove band ${i + 1}`}
              className="grid h-[30px] w-[30px] place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
            >
              <X size={13} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...bands, { min: 0, max: 0, label: "" }])}
        className="h-7 w-fit rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
      >
        + Add band
      </button>
    </div>
  );
}

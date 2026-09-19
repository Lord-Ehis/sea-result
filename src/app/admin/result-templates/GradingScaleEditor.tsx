"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createGradingScale } from "./version-actions";
import type { GradingScaleBandInput, GradingScaleSummary } from "./version-types";

const rowInputClass = "h-[30px] min-w-0 rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary";

function defaultNewBands(): GradingScaleBandInput[] {
  return [
    { minScore: 70, maxScore: 100, gradeCode: "A", remark: "Excellent", displayOrder: 0 },
    { minScore: 0, maxScore: 69.99, gradeCode: "F", remark: "Needs improvement", displayOrder: 1 },
  ];
}

// Picks which reusable, school-owned grading scale a version resolves
// against (falls back to the school's default scale when none is picked),
// plus a lightweight way to define a brand new one inline.
export function GradingScaleEditor({
  scales,
  selectedId,
  onSelect,
  onScaleCreated,
}: {
  scales: GradingScaleSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onScaleCreated: (scale: GradingScaleSummary) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [bands, setBands] = useState<GradingScaleBandInput[]>(defaultNewBands());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultScale = scales.find((s) => s.isDefault);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await createGradingScale({ name, bands });
        onScaleCreated({ id, name, isDefault: false, bands });
        onSelect(id);
        setCreating(false);
        setName("");
        setBands(defaultNewBands());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create grading scale.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5 text-[10px] text-text-muted">
        Grading scale
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          className="h-[35px] max-w-[280px] rounded-md border border-border bg-bg-card px-2.5 text-caption text-text-primary"
        >
          <option value="">{defaultScale ? `School default (${defaultScale.name})` : "School default"}</option>
          {scales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-7 w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
        >
          <Plus size={12} strokeWidth={1.8} />
          New grading scale
        </button>
      ) : (
        <div className="grid gap-2 rounded-md border border-border bg-bg-page p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Scale name (e.g. Senior secondary scale)"
            className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
          />
          <div className="grid gap-1.5">
            {bands.map((band, i) => (
              <div key={i} className="grid grid-cols-[54px_54px_44px_1fr_auto] items-center gap-1.5">
                <input
                  type="number"
                  value={band.minScore}
                  onChange={(e) => setBands(bands.map((b, bi) => (bi === i ? { ...b, minScore: Number(e.target.value) } : b)))}
                  placeholder="Min"
                  className={rowInputClass}
                />
                <input
                  type="number"
                  value={band.maxScore}
                  onChange={(e) => setBands(bands.map((b, bi) => (bi === i ? { ...b, maxScore: Number(e.target.value) } : b)))}
                  placeholder="Max"
                  className={rowInputClass}
                />
                <input
                  value={band.gradeCode}
                  onChange={(e) => setBands(bands.map((b, bi) => (bi === i ? { ...b, gradeCode: e.target.value } : b)))}
                  placeholder="Grade"
                  className={rowInputClass}
                />
                <input
                  value={band.remark}
                  onChange={(e) => setBands(bands.map((b, bi) => (bi === i ? { ...b, remark: e.target.value } : b)))}
                  placeholder="Remark"
                  className={rowInputClass}
                />
                <button
                  type="button"
                  onClick={() => setBands(bands.filter((_, bi) => bi !== i))}
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
            onClick={() => setBands([...bands, { minScore: 0, maxScore: 0, gradeCode: "", remark: "", displayOrder: bands.length }])}
            className="h-7 w-fit rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
          >
            + Add band
          </button>
          {error && <p className="m-0 text-[10px] text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !name.trim()}
              className="h-7 rounded-md border border-primary bg-primary px-3 text-[10px] font-medium text-white disabled:opacity-60"
            >
              Save scale
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="h-7 rounded-md border border-border px-3 text-[10px] font-medium text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

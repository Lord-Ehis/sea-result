"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { SectionInput } from "./version-types";

const rowInputClass = "h-[30px] min-w-0 rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary";

function move<T>(list: T[], i: number, direction: -1 | 1): T[] {
  const j = i + direction;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((item, idx) => ({ ...item, displayOrder: idx }) as T);
}

function weightSum(section: SectionInput): number {
  return section.components.reduce((sum, c) => sum + c.weightPercent, 0);
}

// Configures a version's subjects ("sections") and, per subject, the
// weighted assessment components that make it up (e.g. CA1/CA2/Exam) — the
// spec's replacement for the old Grid field's single shared subjects ×
// score-columns table. Components must sum to exactly 100% weight per
// section before the version can be activated (validated server-side too).
export function SectionsEditor({ sections, onChange }: { sections: SectionInput[]; onChange: (sections: SectionInput[]) => void }) {
  function addSection() {
    onChange([
      ...sections,
      { id: crypto.randomUUID(), name: "", displayOrder: sections.length, components: [] },
    ]);
  }

  function updateSection(id: string, patch: Partial<SectionInput>) {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSection(id: string) {
    onChange(sections.filter((s) => s.id !== id));
  }

  function addComponent(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      components: [
        ...section.components,
        {
          id: crypto.randomUUID(),
          componentName: "",
          componentCode: "",
          maxScore: 100,
          weightPercent: 0,
          displayOrder: section.components.length,
          isRequired: true,
        },
      ],
    });
  }

  return (
    <div className="grid gap-3">
      {sections.length === 0 && (
        <div className="rounded-md border border-dashed border-border px-5 py-6 text-center text-caption text-text-muted">
          No subjects yet. Add one below.
        </div>
      )}
      {sections.map((section, si) => {
        const sum = weightSum(section);
        const sumOk = section.components.length > 0 && Math.abs(sum - 100) < 0.01;
        return (
          <div key={section.id} className="rounded-md border border-border bg-bg-card">
            <div className="flex flex-col gap-2 border-b border-border p-2.5 sm:flex-row sm:items-center">
              <input
                value={section.name}
                onChange={(e) => updateSection(section.id, { name: e.target.value })}
                placeholder="Subject name"
                className="min-w-0 flex-1 rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption font-medium text-text-primary"
              />
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                {section.components.length > 0 && (
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium ${
                      sumOk ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
                    }`}
                  >
                    {sum.toFixed(2)}% weight
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onChange(move(sections, si, -1))}
                    disabled={si === 0}
                    aria-label={`Move ${section.name || "subject"} up`}
                    className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                  >
                    <ChevronUp size={14} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(move(sections, si, 1))}
                    disabled={si === sections.length - 1}
                    aria-label={`Move ${section.name || "subject"} down`}
                    className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                  >
                    <ChevronDown size={14} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(section.id)}
                    aria-label={`Remove ${section.name || "subject"}`}
                    className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                </span>
              </div>
            </div>

            <div className="grid gap-1.5 p-2.5">
              {section.components.map((c, ci) => (
                <div key={c.id} className="grid grid-cols-[1fr_70px_64px_64px_auto] items-center gap-1.5">
                  <input
                    value={c.componentName}
                    onChange={(e) =>
                      updateSection(section.id, {
                        components: section.components.map((x) => (x.id === c.id ? { ...x, componentName: e.target.value } : x)),
                      })
                    }
                    placeholder="Component (e.g. CA1)"
                    className={rowInputClass}
                  />
                  <input
                    value={c.componentCode}
                    onChange={(e) =>
                      updateSection(section.id, {
                        components: section.components.map((x) => (x.id === c.id ? { ...x, componentCode: e.target.value.toUpperCase() } : x)),
                      })
                    }
                    placeholder="Code"
                    className={rowInputClass}
                  />
                  <input
                    type="number"
                    value={c.maxScore}
                    onChange={(e) =>
                      updateSection(section.id, {
                        components: section.components.map((x) => (x.id === c.id ? { ...x, maxScore: Number(e.target.value) } : x)),
                      })
                    }
                    placeholder="Max"
                    className={rowInputClass}
                  />
                  <input
                    type="number"
                    value={c.weightPercent}
                    onChange={(e) =>
                      updateSection(section.id, {
                        components: section.components.map((x) => (x.id === c.id ? { ...x, weightPercent: Number(e.target.value) } : x)),
                      })
                    }
                    placeholder="Weight %"
                    className={rowInputClass}
                  />
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => updateSection(section.id, { components: move(section.components, ci, -1) })}
                      disabled={ci === 0}
                      aria-label={`Move ${c.componentName || "component"} up`}
                      className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                    >
                      <ChevronUp size={14} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSection(section.id, { components: move(section.components, ci, 1) })}
                      disabled={ci === section.components.length - 1}
                      aria-label={`Move ${c.componentName || "component"} down`}
                      className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                    >
                      <ChevronDown size={14} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSection(section.id, { components: section.components.filter((x) => x.id !== c.id) })
                      }
                      aria-label={`Remove ${c.componentName || "component"}`}
                      className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                    >
                      <X size={14} strokeWidth={1.8} />
                    </button>
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addComponent(section.id)}
                className="h-7 w-fit rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
              >
                + Add component
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addSection}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-page text-caption font-medium text-primary hover:bg-primary-bg"
      >
        + Add subject
      </button>
    </div>
  );
}

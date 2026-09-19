"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { RatingCategoryInput } from "./version-types";

function move<T>(list: T[], i: number, direction: -1 | 1): T[] {
  const j = i + direction;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((item, idx) => ({ ...item, displayOrder: idx }) as T);
}

// Groups affective/psychomotor rating items under named categories (e.g.
// "Affective domain") sharing one scale — the spec's replacement for the
// old flat, ungrouped "Rating scale" fields.
export function RatingCategoriesEditor({
  categories,
  onChange,
}: {
  categories: RatingCategoryInput[];
  onChange: (categories: RatingCategoryInput[]) => void;
}) {
  function addCategory() {
    onChange([
      ...categories,
      { id: crypto.randomUUID(), name: "", displayOrder: categories.length, ratingOptions: ["Excellent", "Very Good", "Good", "Poor", "Very Poor"], items: [] },
    ]);
  }

  function update(id: string, patch: Partial<RatingCategoryInput>) {
    onChange(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div className="grid gap-3">
      {categories.length === 0 && (
        <div className="rounded-md border border-dashed border-border px-5 py-6 text-center text-caption text-text-muted">
          No rating categories yet.
        </div>
      )}
      {categories.map((category, ci) => (
        <div key={category.id} className="rounded-md border border-border bg-bg-card">
          <div className="flex flex-col gap-2 border-b border-border p-2.5 sm:flex-row sm:items-center">
            <input
              value={category.name}
              onChange={(e) => update(category.id, { name: e.target.value })}
              placeholder="Category name (e.g. Affective domain)"
              className="min-w-0 flex-1 rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption font-medium text-text-primary"
            />
            <span className="flex items-center gap-0.5 sm:justify-end">
              <button
                type="button"
                onClick={() => onChange(move(categories, ci, -1))}
                disabled={ci === 0}
                aria-label={`Move ${category.name || "category"} up`}
                className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
              >
                <ChevronUp size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => onChange(move(categories, ci, 1))}
                disabled={ci === categories.length - 1}
                aria-label={`Move ${category.name || "category"} down`}
                className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
              >
                <ChevronDown size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => onChange(categories.filter((c) => c.id !== category.id))}
                aria-label={`Remove ${category.name || "category"}`}
                className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
              >
                <X size={14} strokeWidth={1.8} />
              </button>
            </span>
          </div>

          <div className="grid gap-3 p-2.5">
            <div className="grid gap-1.5">
              <span className="text-[10px] text-text-muted">Scale options (shared by every item below), in order</span>
              <div className="grid gap-1">
                {category.ratingOptions.map((opt, oi) => (
                  <div key={oi} className="grid grid-cols-[1fr_auto] items-center gap-1.5">
                    <input
                      value={opt}
                      onChange={(e) =>
                        update(category.id, {
                          ratingOptions: category.ratingOptions.map((o, i) => (i === oi ? e.target.value : o)),
                        })
                      }
                      placeholder="Option label"
                      className="h-[30px] min-w-0 rounded-md border border-border bg-bg-page px-2 text-[10px] text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => update(category.id, { ratingOptions: category.ratingOptions.filter((_, i) => i !== oi) })}
                      aria-label={`Remove ${opt || "option"}`}
                      className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                    >
                      <X size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => update(category.id, { ratingOptions: [...category.ratingOptions, ""] })}
                className="h-7 w-fit rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
              >
                + Add option
              </button>
            </div>

            <div className="grid gap-1.5">
              <span className="text-[10px] text-text-muted">Items</span>
              <div className="grid gap-1">
                {category.items.map((item, ii) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5">
                    <input
                      value={item.name}
                      onChange={(e) =>
                        update(category.id, { items: category.items.map((it) => (it.id === item.id ? { ...it, name: e.target.value } : it)) })
                      }
                      placeholder="e.g. Punctuality"
                      className="h-[30px] min-w-0 rounded-md border border-border bg-bg-page px-2 text-[10px] text-text-primary"
                    />
                    <label className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                      <input
                        type="checkbox"
                        checked={item.isEnabled}
                        onChange={(e) =>
                          update(category.id, {
                            items: category.items.map((it) => (it.id === item.id ? { ...it, isEnabled: e.target.checked } : it)),
                          })
                        }
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      Enabled
                    </label>
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => update(category.id, { items: move(category.items, ii, -1) })}
                        disabled={ii === 0}
                        aria-label={`Move ${item.name || "item"} up`}
                        className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                      >
                        <ChevronUp size={14} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => update(category.id, { items: move(category.items, ii, 1) })}
                        disabled={ii === category.items.length - 1}
                        aria-label={`Move ${item.name || "item"} down`}
                        className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                      >
                        <ChevronDown size={14} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => update(category.id, { items: category.items.filter((it) => it.id !== item.id) })}
                        aria-label={`Remove ${item.name || "item"}`}
                        className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                      >
                        <X size={14} strokeWidth={1.8} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  update(category.id, {
                    items: [...category.items, { id: crypto.randomUUID(), name: "", displayOrder: category.items.length, isEnabled: true }],
                  })
                }
                className="h-7 w-fit rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
              >
                + Add item
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addCategory}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-page text-caption font-medium text-primary hover:bg-primary-bg"
      >
        + Add rating category
      </button>
    </div>
  );
}

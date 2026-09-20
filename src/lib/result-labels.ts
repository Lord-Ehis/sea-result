import type { TemplateField } from "@/app/admin/result-templates/actions";
import { gridKey } from "@/lib/grid-compute";
import { scoreStateKey } from "@/lib/score-state";

/** Human labels for every teacher-entered key ("Mathematics · Exam", "… (status)"), for diffs and audit trails. */
export function keyLabels(fields: TemplateField[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const f of fields) {
    if (f.type === "Computed") continue;
    if (f.type === "Grid" && f.grid) {
      for (const s of f.grid.subjects) {
        for (const c of f.grid.rawColumns) {
          const key = gridKey(f.id, s.id, c.id);
          const label = `${s.name || "Untitled subject"} · ${c.name || "score"}`;
          labels.set(key, label);
          labels.set(scoreStateKey(key), `${label} (status)`);
        }
      }
    } else {
      labels.set(f.id, f.name || "Untitled field");
    }
  }
  return labels;
}

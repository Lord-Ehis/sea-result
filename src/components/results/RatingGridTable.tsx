import type { RatingGridData } from "@/lib/rating-grid";

// A category of "Rating scale" fields (Affective domain, Psychomotor
// domain, ...) as a checkbox-style grid: one row per trait, one column per
// rating option, a mark in whichever column the student was rated.
export function RatingGridTable({ grid }: { grid: RatingGridData }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-bg-page px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
        {grid.categoryName}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-caption">
          <thead>
            <tr>
              <th className="border-b border-border px-3 py-1.5 font-medium text-text-secondary"></th>
              {grid.options.map((o) => (
                <th key={o} className="border-b border-border px-3 py-1.5 text-center font-medium text-text-secondary">
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 font-medium">{item.name}</td>
                {grid.options.map((o) => (
                  <td key={o} className="px-3 py-1.5 text-center text-text-secondary">
                    {item.value === o ? "✓" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

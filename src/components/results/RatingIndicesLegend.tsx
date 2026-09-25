import type { RatingGridData } from "@/lib/rating-grid";

// "Rating indices": what each rating number means, printed once under the
// rating grids. Taken from the first category that defines meanings — the
// categories on a report card share one scale.
export function RatingIndicesLegend({ grids }: { grids: RatingGridData[] }) {
  const source = grids.find((g) => g.meanings?.some((m) => m.trim()));
  if (!source?.meanings) return null;
  const rows = source.options.map((option, i) => ({ option, meaning: source.meanings?.[i]?.trim() ?? "" })).filter((r) => r.meaning);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-bg-page px-3 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">
        Rating indices
      </div>
      <ul className="m-0 grid list-none gap-1 p-2 text-[10px] text-text-secondary">
        {rows.map((r) => (
          <li key={r.option}>
            <strong className="font-medium text-text-primary">{r.option}</strong> - {r.meaning}
          </li>
        ))}
      </ul>
    </div>
  );
}

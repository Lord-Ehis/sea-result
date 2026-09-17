// One flat field's name/value, used on the public lookup page and parent
// dashboard. A multi-line value (e.g. a "Result analysis" narrative)
// stacks label-above-value instead of the usual side-by-side row, since a
// paragraph next to a short label side-by-side reads badly.
export function FieldValueRow({ name, value, background = "card" }: { name: string; value: string; background?: "card" | "page" }) {
  const bgClass = background === "card" ? "bg-bg-card" : "bg-bg-page";

  if (value.includes("\n")) {
    return (
      <div className={`grid gap-1 rounded-md border border-border ${bgClass} px-3 py-2.5`}>
        <span className="text-caption text-text-muted">{name}</span>
        <span className="whitespace-pre-line text-body text-text-primary">{value}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border border-border ${bgClass} px-3 py-2.5`}>
      <span className="text-caption text-text-muted">{name}</span>
      <span className="text-body font-medium text-text-primary">{value}</span>
    </div>
  );
}

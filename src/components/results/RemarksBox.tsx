import type { SnapshotRemarks } from "@/lib/snapshot";

// The teacher's and principal's written remarks, each in its own box.
export function RemarksBox({ remarks }: { remarks: SnapshotRemarks }) {
  const items = [
    { label: "Teacher's remark", text: remarks.teacher },
    { label: "Principal's remark", text: remarks.principal },
  ].filter((i): i is { label: string; text: string } => !!i.text);
  return (
    <div className="grid gap-3">
      {items.map((i) => (
        <div key={i.label}>
          <span className="block text-[10px] font-medium text-text-secondary">{i.label}:</span>
          <p className="m-0 mt-1 whitespace-pre-line rounded-md border border-border px-3 py-2 text-center text-caption italic">{i.text}</p>
        </div>
      ))}
    </div>
  );
}

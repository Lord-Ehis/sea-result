import type { AttendanceSummary } from "@/lib/attendance";

// Times school opened / present / absent, and the attendance percentage.
export function AttendanceSummaryBox({ attendance }: { attendance: AttendanceSummary }) {
  const items = [
    { label: "Times school opened", value: String(attendance.opened) },
    { label: "Times present", value: String(attendance.present) },
    { label: "Times absent", value: String(attendance.absent) },
    { label: "Attendance", value: attendance.percentage === "—" ? "—" : `${attendance.percentage}%` },
  ];
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-bg-page px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
        Attendance summary
      </div>
      <dl className="grid grid-cols-2 gap-3 p-3 text-caption sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-[10px] text-text-muted">{i.label}</dt>
            <dd className="font-medium">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

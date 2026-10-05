import type { TemplateField } from "@/app/admin/result-templates/actions";

export type AttendanceSummary = { opened: number; present: number; absent: number; percentage: string };

// Reads the two attendance-tagged Number fields (times school opened / times
// present) and works out the rest, so absences and the percentage can never
// disagree with what the teacher entered. null when either number is missing
// or present exceeds opened — there is nothing trustworthy to show.
export function attendanceSummary(fields: TemplateField[], data: Record<string, string>): AttendanceSummary | null {
  const read = (role: "opened" | "present") => {
    const field = fields.find((f) => f.attendance === role);
    const raw = field ? (data[field.id] ?? "").trim() : "";
    return /^\d+$/.test(raw) ? Number(raw) : null;
  };
  const opened = read("opened");
  const present = read("present");
  if (opened === null || present === null || present > opened) return null;
  return { opened, present, absent: opened - present, percentage: opened > 0 ? ((present / opened) * 100).toFixed(1) : "—" };
}

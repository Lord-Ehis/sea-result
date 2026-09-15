"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { saveClassResults } from "./actions";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { computeOwnFields } from "@/lib/template-compute";

type StudentRow = {
  id: string;
  name: string;
  studentCode: string;
  data: Record<string, string>;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PUBLISHED" | null;
  rejectionNote: string | null;
};

const DROPDOWN_OPTIONS = ["Excellent", "Very Good", "Good", "Fair", "Poor"];
const RATING_OPTIONS = ["1", "2", "3", "4", "5"];

// Position needs the whole class's batch; cumulative needs prior terms'
// published history. Neither is available during live entry — both only
// get a value once the batch is actually published.
function computedAtPublish(field: TemplateField) {
  return field.formula?.kind === "position" || field.formula?.kind === "cumulative";
}

export function ResultEntryClient({
  classId,
  className,
  templateId,
  templateName,
  term,
  session,
  fields,
  students,
}: {
  classId: string;
  className: string;
  templateId: string;
  templateName: string;
  term: string;
  session: string;
  fields: TemplateField[];
  students: StudentRow[];
}) {
  const [entries, setEntries] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(students.map((s) => [s.id, { ...s.data }])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const overallStatus = useMemo(() => {
    const statuses = students.map((s) => s.status).filter(Boolean);
    if (statuses.length === 0) return "Not started";
    if (statuses.some((s) => s === "REJECTED")) return "Sent back for corrections";
    if (statuses.length === students.length && statuses.every((s) => s === "SUBMITTED" || s === "PUBLISHED")) return "Submitted";
    return "In progress";
  }, [students]);

  const locked = overallStatus === "Submitted";
  const rejectionNote = students.find((s) => s.rejectionNote)?.rejectionNote;

  const computedByStudent = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const s of students) map.set(s.id, computeOwnFields(fields, entries[s.id] ?? {}));
    return map;
  }, [students, fields, entries]);

  const requiredFields = useMemo(() => fields.filter((f) => !computedAtPublish(f)), [fields]);
  const completedCount = useMemo(
    () => students.filter((s) => requiredFields.every((f) => (computedByStudent.get(s.id)?.[f.id] ?? "").trim() !== "")).length,
    [students, requiredFields, computedByStudent],
  );
  const allComplete = requiredFields.length > 0 && completedCount === students.length;

  function setValue(studentId: string, fieldId: string, value: string) {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [fieldId]: value } }));
  }

  function buildEntries() {
    return students.map((s) => ({ studentId: s.id, data: entries[s.id] ?? {} }));
  }

  function handleSaveDraft() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await saveClassResults({ classId, templateId, term, session, entries: buildEntries(), submit: false });
        setMessage("Draft saved.");
        setTimeout(() => setMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save draft.");
      }
    });
  }

  function handleSubmit() {
    if (!allComplete) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await saveClassResults({ classId, templateId, term, session, entries: buildEntries(), submit: true });
        setMessage("Results submitted for approval.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit results.");
      }
    });
  }

  return (
    <>
      <Link href="/teacher/classes" className="mb-5 inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-primary">
        <ArrowLeft size={15} strokeWidth={1.8} />
        Back to my classes
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader eyebrow="Teacher workspace / My classes" title={`Result entry · ${className}`} intro={`${templateName} · ${term}`} />
        <StatusPill
          label={overallStatus}
          tone={overallStatus === "Submitted" ? "success" : overallStatus === "Sent back for corrections" ? "warning" : "neutral"}
        />
      </div>

      {rejectionNote && overallStatus === "Sent back for corrections" && (
        <p className="mb-5 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-caption leading-relaxed text-warning">
          <strong>Sent back for corrections:</strong> {rejectionNote}
        </p>
      )}
      {message && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}
      {error && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      <div className="mb-5 rounded-md border border-border bg-bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-body font-medium text-text-secondary">Entry progress</strong>
          <span className="text-caption font-medium tabular-nums text-primary">
            {completedCount} of {students.length} students completed
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-sidebar">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${students.length ? (completedCount / students.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-5">
          <h2 className="m-0 text-heading font-medium text-text-primary">Student scores</h2>
          <p className="mt-1.5 text-caption text-text-muted">Complete every field for each student before submitting.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left" style={{ minWidth: 260 + fields.length * 150 }}>
            <thead className="bg-[#fafbfb]">
              <tr>
                <th className="border-b border-border px-5 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">Student</th>
                {fields.map((f) => (
                  <th key={f.id} className="border-b border-border px-3 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                    {f.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-[#f0f2f3] last:border-0">
                  <td className="px-5 py-3">
                    <strong className="block text-body font-medium text-text-primary">{s.name}</strong>
                    <span className="text-caption text-text-muted">{s.studentCode}</span>
                  </td>
                  {fields.map((f) => {
                    const value = entries[s.id]?.[f.id] ?? "";
                    const commonProps = {
                      disabled: locked || pending,
                      className:
                        "h-[34px] w-full min-w-[110px] rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary disabled:bg-bg-page disabled:text-text-muted",
                    };
                    if (f.type === "Computed") {
                      const computedValue = computedByStudent.get(s.id)?.[f.id] ?? "";
                      return (
                        <td key={f.id} className="px-3 py-2">
                          <div className="flex h-[34px] w-full min-w-[110px] items-center rounded-md border border-dashed border-border bg-bg-page px-2 text-caption text-text-secondary">
                            {computedAtPublish(f) ? <span className="italic text-text-muted">At publish</span> : computedValue || "—"}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={f.id} className="px-3 py-2">
                        {f.type === "Number" ? (
                          <input type="number" value={value} onChange={(e) => setValue(s.id, f.id, e.target.value)} {...commonProps} />
                        ) : f.type === "Dropdown" ? (
                          <select value={value} onChange={(e) => setValue(s.id, f.id, e.target.value)} {...commonProps}>
                            <option value="">Select…</option>
                            {DROPDOWN_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "Rating scale" ? (
                          <select value={value} onChange={(e) => setValue(s.id, f.id, e.target.value)} {...commonProps}>
                            <option value="">—</option>
                            {RATING_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt} / 5
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={value} onChange={(e) => setValue(s.id, f.id, e.target.value)} {...commonProps} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3.5 text-caption text-text-muted">
          {locked ? "Results have been submitted for approval." : "Changes are saved to your account, not just this browser."}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-caption text-text-muted">
          {locked
            ? "This batch is locked while it's under review."
            : allComplete
              ? "All student records are complete and ready to submit."
              : `${students.length - completedCount} student record(s) still need scores.`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={locked || pending}
            className="inline-flex h-[39px] items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={locked || !allComplete || pending}
            className="inline-flex h-[39px] items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-45"
          >
            Submit for approval
          </button>
        </div>
      </div>
    </>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { GridEntryTable } from "@/components/results/GridEntryTable";
import { saveClassResults } from "./actions";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import { computedAtPublish } from "@/lib/result-field-display";
import { DROPDOWN_OPTIONS, ratingOptionsFor } from "@/lib/field-options";
import { identicalScoreWarnings, pickAllowedData, validateStudentEntry } from "@/lib/result-validate";

type StudentRow = {
  id: string;
  name: string;
  studentCode: string;
  data: Record<string, string>;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PUBLISHED" | null;
  // Null until the student's record exists; sent back on save so a stale
  // edit (someone else saved first) is caught instead of overwriting them.
  revision: number | null;
  rejectionNote: string | null;
};

const inputClass =
  "h-[34px] w-full min-w-[110px] rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary disabled:bg-bg-page disabled:text-text-muted";

function FlatFieldControl({
  field,
  value,
  computedValue,
  disabled,
  onChange,
}: {
  field: TemplateField;
  value: string;
  computedValue: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (field.type === "Computed") {
    return (
      <div className="flex min-h-[34px] w-full min-w-[110px] items-center whitespace-pre-line rounded-md border border-dashed border-border bg-bg-page px-2 py-2 text-caption text-text-secondary">
        {computedAtPublish(field) ? <span className="italic text-text-muted">At publish</span> : computedValue || "—"}
      </div>
    );
  }
  if (field.type === "Number") {
    return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass} />;
  }
  if (field.type === "Dropdown") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass}>
        <option value="">Select…</option>
        {DROPDOWN_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "Rating scale") {
    const isLegacyNumericScale = !field.ratingOptions || field.ratingOptions.length === 0;
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass}>
        <option value="">—</option>
        {ratingOptionsFor(field).map((opt) => (
          <option key={opt} value={opt}>
            {isLegacyNumericScale ? `${opt} / 5` : opt}
          </option>
        ))}
      </select>
    );
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass} />;
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
  const [revisions, setRevisions] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.revision])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(students[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  const gridField = useMemo(() => fields.find((f) => f.type === "Grid" && f.grid), [fields]);
  const flatFields = useMemo(() => fields.filter((f) => f.type !== "Grid"), [fields]);

  const overallStatus = useMemo(() => {
    const statuses = students.map((s) => s.status).filter(Boolean);
    if (statuses.length === 0) return "Not started";
    if (statuses.some((s) => s === "REJECTED")) return "Sent back for corrections";
    if (statuses.length === students.length && statuses.every((s) => s === "SUBMITTED" || s === "PUBLISHED")) return "Submitted";
    return "In progress";
  }, [students]);

  const locked = overallStatus === "Submitted";
  const rejectionNote = students.find((s) => s.rejectionNote)?.rejectionNote;

  const expandedFields = useMemo(() => expandThisTermFields(fields), [fields]);

  const computedByStudent = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const s of students) map.set(s.id, computeOwnFields(expandedFields, entries[s.id] ?? {}));
    return map;
  }, [students, expandedFields, entries]);

  // The same validator the server runs on save/submit, so what the teacher
  // sees blocked here is exactly what the server would refuse.
  const validationByStudent = useMemo(
    () => new Map(students.map((s) => [s.id, validateStudentEntry(fields, pickAllowedData(fields, entries[s.id] ?? {}))])),
    [students, fields, entries],
  );
  const completedCount = useMemo(
    () =>
      locked
        ? students.length // already submitted: it passed the server's checks when it was
        : students.filter((s) => {
            const v = validationByStudent.get(s.id);
            return !!v && v.errors.length === 0 && v.missing.length === 0;
          }).length,
    [locked, students, validationByStudent],
  );
  const errorIssues = useMemo(
    () => students.flatMap((s) => (validationByStudent.get(s.id)?.errors ?? []).map((issue) => ({ student: s.name, issue }))),
    [students, validationByStudent],
  );
  const warnings = useMemo(
    () => identicalScoreWarnings(fields, students.map((s) => entries[s.id] ?? {})),
    [fields, students, entries],
  );
  const canSubmit = students.length > 0 && completedCount === students.length && errorIssues.length === 0;

  function setValue(studentId: string, key: string, value: string) {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [key]: value } }));
  }

  function buildEntries() {
    return students.map((s) => ({ studentId: s.id, data: entries[s.id] ?? {}, revision: revisions[s.id] ?? null }));
  }

  function run(submit: boolean, successMessage: string, fallbackError: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveClassResults({ classId, templateId, term, session, entries: buildEntries(), submit });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setRevisions((prev) => ({ ...prev, ...result.revisions }));
        setMessage(successMessage);
        if (!submit) setTimeout(() => setMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackError);
      }
    });
  }

  function handleSaveDraft() {
    run(false, "Draft saved.", "Could not save draft.");
  }

  function handleSubmit() {
    if (!canSubmit) return;
    run(true, "Results submitted for approval.", "Could not submit results.");
  }

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null;

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

      {errorIssues.length > 0 && !locked && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-caption text-danger">
          <strong className="block">Fix these scores before saving or submitting:</strong>
          <ul className="mt-1.5 grid gap-0.5 pl-4">
            {errorIssues.slice(0, 8).map(({ student, issue }) => (
              <li key={`${student}-${issue.key}`} className="list-disc">
                {student} — {issue.label}: {issue.message}
              </li>
            ))}
            {errorIssues.length > 8 && <li className="list-none">…and {errorIssues.length - 8} more.</li>}
          </ul>
        </div>
      )}
      {warnings.length > 0 && !locked && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-caption text-warning">
          <strong className="block">Worth a second look (won&apos;t stop you submitting):</strong>
          <ul className="mt-1.5 grid gap-0.5 pl-4">
            {warnings.map((w) => (
              <li key={w.message} className="list-disc">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {gridField ? (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">Student scores</h2>
            <p className="mt-1.5 text-caption text-text-muted">Select a student, then complete every field before submitting.</p>
          </div>
          <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
            <div className="max-h-[560px] overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
              {students.map((s) => {
                const v = validationByStudent.get(s.id);
                const complete = !!v && v.errors.length === 0 && v.missing.length === 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${
                      s.id === selectedStudentId ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-page"
                    }`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-caption font-medium">{s.name}</strong>
                      <span className="block truncate text-[10px] text-text-muted">{s.studentCode}</span>
                    </span>
                    <span className={`h-1.5 w-1.5 flex-none rounded-full ${complete ? "bg-success" : "bg-border"}`} />
                  </button>
                );
              })}
            </div>
            <div className="p-5">
              {selectedStudent && (
                <>
                  {flatFields.length > 0 && (
                    <div className="mb-5 grid gap-3 sm:grid-cols-2">
                      {flatFields.map((f) => (
                        <label key={f.id} className="grid gap-1.5 text-[10px] text-text-muted">
                          {f.name}
                          <FlatFieldControl
                            field={f}
                            value={entries[selectedStudent.id]?.[f.id] ?? ""}
                            computedValue={computedByStudent.get(selectedStudent.id)?.[f.id] ?? ""}
                            disabled={locked || pending}
                            onChange={(value) => setValue(selectedStudent.id, f.id, value)}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <GridEntryTable
                    field={gridField}
                    data={entries[selectedStudent.id] ?? {}}
                    computed={computedByStudent.get(selectedStudent.id) ?? {}}
                    onChange={(key, value) => setValue(selectedStudent.id, key, value)}
                    locked={locked || pending}
                  />
                </>
              )}
            </div>
          </div>
          <div className="border-t border-border px-5 py-3.5 text-caption text-text-muted">
            {locked ? "Results have been submitted for approval." : "Changes are saved to your account, not just this browser."}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">Student scores</h2>
            <p className="mt-1.5 text-caption text-text-muted">Complete every field for each student before submitting.</p>
          </div>
          <div className="hidden overflow-x-auto lg:block">
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
                    {fields.map((f) => (
                      <td key={f.id} className="px-3 py-2">
                        <FlatFieldControl
                          field={f}
                          value={entries[s.id]?.[f.id] ?? ""}
                          computedValue={computedByStudent.get(s.id)?.[f.id] ?? ""}
                          disabled={locked || pending}
                          onChange={(value) => setValue(s.id, f.id, value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {students.map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-bg-card p-4">
                <strong className="block text-body font-medium text-text-primary">{s.name}</strong>
                <span className="text-caption text-text-muted">{s.studentCode}</span>
                <div className="mt-3 grid gap-3 border-t border-[#f0f2f3] pt-3">
                  {fields.map((f) => (
                    <label key={f.id} className="grid gap-1.5 text-caption text-text-secondary">
                      {f.name}
                      <FlatFieldControl
                        field={f}
                        value={entries[s.id]?.[f.id] ?? ""}
                        computedValue={computedByStudent.get(s.id)?.[f.id] ?? ""}
                        disabled={locked || pending}
                        onChange={(value) => setValue(s.id, f.id, value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-5 py-3.5 text-caption text-text-muted">
            {locked ? "Results have been submitted for approval." : "Changes are saved to your account, not just this browser."}
          </div>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-caption text-text-muted">
          {locked
            ? "This batch is locked while it's under review."
            : errorIssues.length > 0
              ? `${errorIssues.length} score(s) need fixing before you can save or submit.`
              : canSubmit
                ? "All student records are complete and ready to submit."
                : `${students.length - completedCount} student record(s) still need scores.`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={locked || pending || errorIssues.length > 0}
            className="inline-flex h-[39px] items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={locked || !canSubmit || pending}
            className="inline-flex h-[39px] items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-45"
          >
            Submit for approval
          </button>
        </div>
      </div>
    </>
  );
}

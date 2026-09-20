"use client";

import { memo, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { GridEntryTable } from "@/components/results/GridEntryTable";
import { saveClassResults } from "./actions";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import { computedAtPublish } from "@/lib/result-field-display";
import { DROPDOWN_OPTIONS, ratingOptionsFor } from "@/lib/field-options";
import { identicalScoreWarnings, pickAllowedData, validateStudentEntry } from "@/lib/result-validate";
import { MAX_IMPORT_BYTES, buildErrorReport, buildScoreSheet, parseScoreSheet, type ImportResult } from "@/lib/score-csv";

// A student's data object is replaced only when *that* student is edited, so
// caching by object identity means a keystroke recomputes one student, not
// the whole class (spec: 100 students × 20 subjects × 6 components must not
// freeze the screen). Unedited students hit the cache.
const NO_DATA: Record<string, string> = {};
function memoByData<T>(compute: (data: Record<string, string>) => T): (data: Record<string, string>) => T {
  const cache = new WeakMap<object, T>();
  return (data) => {
    if (cache.has(data)) return cache.get(data)!;
    const value = compute(data);
    cache.set(data, value);
    return value;
  };
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

// Memoised: a keystroke changes at most one student's status, so the other 99
// rows of a big class don't re-render.
const StudentListItem = memo(function StudentListItem({
  id,
  name,
  studentCode,
  selected,
  complete,
  onSelect,
}: {
  id: string;
  name: string;
  studentCode: string;
  selected: boolean;
  complete: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${selected ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-page"}`}
    >
      <span className="min-w-0">
        <strong className="block truncate text-caption font-medium">{name}</strong>
        <span className="block truncate text-[10px] text-text-muted">{studentCode}</span>
      </span>
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${complete ? "bg-success" : "bg-border"}`} />
    </button>
  );
});

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
    if (statuses.length === students.length && statuses.every((s) => s === "SUBMITTED" || s === "APPROVED" || s === "PUBLISHED")) return "Submitted";
    return "In progress";
  }, [students]);

  const locked = overallStatus === "Submitted";
  const rejectionNote = students.find((s) => s.rejectionNote)?.rejectionNote;

  const expandedFields = useMemo(() => expandThisTermFields(fields), [fields]);

  const computeFor = useMemo(() => memoByData((data) => computeOwnFields(expandedFields, data)), [expandedFields]);
  const validateFor = useMemo(() => memoByData((data) => validateStudentEntry(fields, pickAllowedData(fields, data))), [fields]);

  const computedByStudent = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const s of students) map.set(s.id, computeFor(entries[s.id] ?? NO_DATA));
    return map;
  }, [students, computeFor, entries]);

  // The same validator the server runs on save/submit, so what the teacher
  // sees blocked here is exactly what the server would refuse.
  const validationByStudent = useMemo(
    () => new Map(students.map((s) => [s.id, validateFor(entries[s.id] ?? NO_DATA)])),
    [students, validateFor, entries],
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

  const [importReport, setImportReport] = useState<ImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleDownloadSheet() {
    const safe = `${className}-${term}`.replace(/[^\w.-]+/g, "_");
    downloadText(`${safe}-scores.csv`, buildScoreSheet(fields, students, entries));
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setMessage(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError("That file is too large to import (limit 2 MB).");
      return;
    }
    const report = parseScoreSheet(await file.text(), fields, students);
    // Clean rows fill the on-screen sheet only; nothing is saved until the
    // teacher reviews it and presses Save draft (the server checks it again).
    if (report.rowsApplied > 0) {
      setEntries((prev) => {
        const next = { ...prev };
        for (const [studentId, patch] of Object.entries(report.applied)) next[studentId] = { ...prev[studentId], ...patch };
        return next;
      });
    }
    setImportReport(report);
    if (fileInput.current) fileInput.current.value = "";
  }

  function buildEntries() {
    // Only what a teacher entered, and only cells that have a value: a blank
    // is the same as absent to the server, and this keeps a full class well
    // inside the request size limit.
    return students.map((s) => {
      const data = pickAllowedData(fields, entries[s.id] ?? {});
      return { studentId: s.id, data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "")), revision: revisions[s.id] ?? null };
    });
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
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#f0f2f3] pt-4">
          <button
            type="button"
            onClick={handleDownloadSheet}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-card px-3 text-caption font-medium text-text-secondary hover:bg-bg-page"
          >
            <Download size={14} strokeWidth={1.8} />
            Download sheet (CSV)
          </button>
          {!locked && (
            <>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={pending}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-card px-3 text-caption font-medium text-text-secondary hover:bg-bg-page disabled:opacity-50"
              >
                <Upload size={14} strokeWidth={1.8} />
                Import scores (CSV)
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                aria-label="Import scores from a CSV file"
                className="hidden"
                onChange={(e) => void handleImportFile(e.target.files?.[0])}
              />
              <span className="text-caption text-text-muted">Fill in the downloaded sheet in Excel or Sheets, save as CSV, then import. Blank cells are left as they are.</span>
            </>
          )}
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
                  <StudentListItem
                    key={s.id}
                    id={s.id}
                    name={s.name}
                    studentCode={s.studentCode}
                    selected={s.id === selectedStudentId}
                    complete={complete}
                    onSelect={setSelectedStudentId}
                  />
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
      <Modal
        open={importReport !== null}
        onClose={() => setImportReport(null)}
        title="Import results"
        description={importReport ? `${importReport.totalRows} row${importReport.totalRows === 1 ? "" : "s"} read` : undefined}
        width={640}
      >
        {importReport && (
          <div className="grid gap-3 p-6">
            <p className="m-0 text-body text-text-secondary">
              <strong className="font-medium text-success">{importReport.rowsApplied} student{importReport.rowsApplied === 1 ? "" : "s"} filled in</strong>
              {importReport.rowsSkipped > 0 && (
                <>
                  {" · "}
                  <strong className="font-medium text-danger">{importReport.rowsSkipped} row{importReport.rowsSkipped === 1 ? "" : "s"} skipped</strong>
                </>
              )}
              . {importReport.rowsApplied > 0 ? "Review the sheet, then press Save draft — nothing is saved yet." : ""}
            </p>
            {importReport.unknownColumns.length > 0 && (
              <p className="m-0 rounded-md bg-warning-bg px-3 py-2 text-caption text-warning">
                Ignored columns that aren&apos;t on this result sheet: {importReport.unknownColumns.slice(0, 6).join(", ")}
                {importReport.unknownColumns.length > 6 ? "…" : ""}
              </p>
            )}
            {importReport.errors.length > 0 && (
              <div className="max-h-[260px] overflow-auto rounded-md border border-border">
                <table className="w-full border-collapse text-left text-caption">
                  <thead className="bg-[#fafbfb]">
                    <tr>
                      {["Row", "Student", "Column", "Problem"].map((h) => (
                        <th key={h} className="border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importReport.errors.slice(0, 100).map((e, i) => (
                      <tr key={i} className="border-b border-[#f0f2f3] last:border-0">
                        <td className="px-3 py-2 tabular-nums text-text-secondary">{e.row}</td>
                        <td className="px-3 py-2 text-text-secondary">{e.studentCode || "—"}</td>
                        <td className="px-3 py-2 text-text-secondary">{e.column || "—"}</td>
                        <td className="px-3 py-2 text-danger">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {importReport.errors.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadText("import-errors.csv", buildErrorReport(importReport.errors))}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
                >
                  Download error report
                </button>
              )}
              <button
                type="button"
                onClick={() => setImportReport(null)}
                className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

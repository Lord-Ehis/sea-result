"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Users, CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { GridEntryTable } from "@/components/results/GridEntryTable";
import { updateResultValue, publishBatch, sendBackBatch } from "./actions";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields, gridRawKeys } from "@/lib/grid-compute";
import { computedAtPublish } from "@/lib/result-field-display";
import { DROPDOWN_OPTIONS, ratingOptionsFor } from "@/lib/field-options";

type StudentRow = { resultId: string; name: string; studentCode: string; data: Record<string, string> };

// Shared by both the grid-mode per-student panel and the plain flat-field
// table below — type-aware editing for a single non-Grid field (Dropdown/
// Rating scale get a real <select> with save-on-choose, matching entry's
// UX; previously every non-Computed field fell through to a plain text
// input regardless of type).
function FlatFieldEditor({
  field,
  value,
  blank,
  onChange,
  onBlur,
}: {
  field: TemplateField;
  value: string;
  blank: boolean;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}) {
  if (field.type === "Computed") {
    return (
      <div className="flex h-[34px] w-full min-w-[110px] items-center rounded-md border border-dashed border-border bg-bg-page px-2 text-caption text-text-secondary">
        {computedAtPublish(field) ? <span className="italic text-text-muted">At publish</span> : value || "—"}
      </div>
    );
  }

  const borderClass = blank ? "border-warning/50 bg-warning-bg" : "border-border bg-bg-card";
  const selectClass = `h-[34px] w-full min-w-[110px] rounded-md border px-2 text-caption text-text-primary ${borderClass}`;

  if (field.type === "Dropdown") {
    return (
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onBlur(e.target.value);
        }}
        className={selectClass}
      >
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
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onBlur(e.target.value);
        }}
        className={selectClass}
      >
        <option value="">—</option>
        {ratingOptionsFor(field).map((opt) => (
          <option key={opt} value={opt}>
            {isLegacyNumericScale ? `${opt} / 5` : opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
      className={`h-[34px] w-full min-w-[110px] rounded-md border px-2 text-caption text-text-primary ${borderClass}`}
    />
  );
}

export function ReviewClient({
  templateId,
  className,
  term,
  teacherName,
  submittedAt,
  fields,
  students,
}: {
  templateId: string;
  className: string;
  term: string;
  teacherName: string;
  submittedAt: string | null;
  fields: TemplateField[];
  students: StudentRow[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(students.map((s) => [s.resultId, { ...s.data }])),
  );
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(students[0]?.resultId ?? null);
  const [pending, startTransition] = useTransition();

  const gridField = useMemo(() => fields.find((f) => f.type === "Grid" && f.grid), [fields]);
  const flatFields = useMemo(() => fields.filter((f) => f.type !== "Grid"), [fields]);
  const expandedFields = useMemo(() => expandThisTermFields(fields), [fields]);

  const requiredKeys = useMemo(
    () => [...flatFields.filter((f) => !computedAtPublish(f)).map((f) => f.id), ...(gridField ? gridRawKeys(gridField) : [])],
    [flatFields, gridField],
  );
  const emptyCount = useMemo(
    () => students.reduce((n, s) => n + requiredKeys.filter((k) => !(entries[s.resultId]?.[k] ?? "").trim()).length, 0),
    [students, requiredKeys, entries],
  );

  function handleFieldChange(resultId: string, key: string, value: string) {
    setEntries((prev) => ({ ...prev, [resultId]: { ...prev[resultId], [key]: value } }));
  }

  function handleFieldBlur(resultId: string, key: string, value: string) {
    startTransition(async () => {
      try {
        await updateResultValue(resultId, key, value);
        // Mirrors the server's own recompute so Total/Grade reflect the
        // edit immediately, without waiting on a full page reload.
        setEntries((prev) => ({ ...prev, [resultId]: computeOwnFields(expandedFields, { ...prev[resultId], [key]: value }) }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save correction.");
      }
    });
  }

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      try {
        await publishBatch(templateId);
        setConfirmOpen(false);
        router.push("/admin/results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not publish results.");
      }
    });
  }

  function handleSendBack() {
    if (!note.trim()) {
      setNoteError("Write a note explaining the corrections needed before sending back.");
      return;
    }
    setNoteError(null);
    setError(null);
    startTransition(async () => {
      try {
        await sendBackBatch(templateId, note);
        router.push("/admin/results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send results back.");
      }
    });
  }

  const selectedStudent = students.find((s) => s.resultId === selectedResultId) ?? null;
  const selectedBlankKeys = useMemo(() => {
    if (!selectedStudent) return new Set<string>();
    const data = entries[selectedStudent.resultId] ?? {};
    return new Set(requiredKeys.filter((k) => !(data[k] ?? "").trim()));
  }, [selectedStudent, entries, requiredKeys]);

  return (
    <>
      <Link href="/admin/results" className="mb-5 inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-primary">
        <ArrowLeft size={15} strokeWidth={1.8} />
        Back to results
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-title font-medium tracking-tight text-text-primary">Review results · {className}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-caption text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} strokeWidth={1.8} className="text-text-muted" />
              {teacherName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} strokeWidth={1.8} className="text-text-muted" />
              {term} {submittedAt && `· Submitted ${new Date(submittedAt).toLocaleDateString("en-GB")}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendBack}
            disabled={pending}
            className="inline-flex h-[38px] items-center gap-2 rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary disabled:opacity-50"
          >
            Send back for corrections
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
            className="inline-flex h-[38px] items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-50"
          >
            <Check size={15} strokeWidth={1.8} />
            Approve &amp; publish
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      <div className="mb-5 flex items-center justify-between gap-3 rounded-md border border-border bg-bg-card px-5 py-4">
        <div>
          <strong className="block text-body font-medium text-text-primary">
            {emptyCount === 0 ? "All fields complete" : `${emptyCount} field(s) still blank`}
          </strong>
          <p className="mt-1 text-caption text-text-muted">Edit any value directly before approving, or send the batch back.</p>
        </div>
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-caption ${emptyCount === 0 ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}
        >
          {emptyCount === 0 ? "Ready" : `${emptyCount} blank`}
        </span>
      </div>

      {gridField ? (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">Student scores</h2>
            <p className="mt-1.5 text-caption text-text-muted">{students.length} students submitted</p>
          </div>
          <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
            <div className="max-h-[560px] overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
              {students.map((s) => {
                const data = entries[s.resultId] ?? {};
                const blankCount = requiredKeys.filter((k) => !(data[k] ?? "").trim()).length;
                return (
                  <button
                    key={s.resultId}
                    type="button"
                    onClick={() => setSelectedResultId(s.resultId)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${
                      s.resultId === selectedResultId ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-page"
                    }`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-caption font-medium">{s.name}</strong>
                      <span className="block truncate text-[10px] text-text-muted">{s.studentCode}</span>
                    </span>
                    <span className={`h-1.5 w-1.5 flex-none rounded-full ${blankCount === 0 ? "bg-success" : "bg-warning"}`} />
                  </button>
                );
              })}
            </div>
            <div className="p-5">
              {selectedStudent && (
                <>
                  {flatFields.length > 0 && (
                    <div className="mb-5 grid gap-3 sm:grid-cols-2">
                      {flatFields.map((f) => {
                        const value = entries[selectedStudent.resultId]?.[f.id] ?? "";
                        return (
                          <label key={f.id} className="grid gap-1.5 text-[10px] text-text-muted">
                            {f.name}
                            <FlatFieldEditor
                              field={f}
                              value={value}
                              blank={!value.trim()}
                              onChange={(v) => handleFieldChange(selectedStudent.resultId, f.id, v)}
                              onBlur={(v) => handleFieldBlur(selectedStudent.resultId, f.id, v)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <GridEntryTable
                    field={gridField}
                    data={entries[selectedStudent.resultId] ?? {}}
                    computed={entries[selectedStudent.resultId] ?? {}}
                    onChange={(key, value) => {
                      handleFieldChange(selectedStudent.resultId, key, value);
                      handleFieldBlur(selectedStudent.resultId, key, value);
                    }}
                    locked={pending}
                    blankKeys={selectedBlankKeys}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">Student scores</h2>
            <p className="mt-1.5 text-caption text-text-muted">{students.length} students submitted</p>
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
                  <tr key={s.resultId} className="border-b border-[#f0f2f3] last:border-0">
                    <td className="px-5 py-3">
                      <strong className="block text-body font-medium text-text-primary">{s.name}</strong>
                      <span className="text-caption text-text-muted">{s.studentCode}</span>
                    </td>
                    {fields.map((f) => {
                      const value = entries[s.resultId]?.[f.id] ?? "";
                      return (
                        <td key={f.id} className="px-3 py-2">
                          <FlatFieldEditor
                            field={f}
                            value={value}
                            blank={!value.trim()}
                            onChange={(v) => handleFieldChange(s.resultId, f.id, v)}
                            onBlur={(v) => handleFieldBlur(s.resultId, f.id, v)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-5 rounded-md border border-border bg-bg-card p-5">
        <h2 className="m-0 text-body font-medium text-text-primary">Admin notes</h2>
        <p className="mt-1.5 mb-3.5 text-caption text-text-muted">Explain what needs to be corrected before sending results back to the teacher.</p>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (e.target.value.trim()) setNoteError(null);
          }}
          placeholder="e.g. Please verify the missing scores and update the affected comments…"
          className="min-h-[98px] w-full resize-y rounded-md border border-border bg-bg-card p-3 text-body text-text-primary"
        />
        <p className={`mt-2 text-caption ${noteError ? "text-danger" : "text-text-muted"}`}>
          {noteError ?? "A note is required when sending results back for corrections."}
        </p>
      </section>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Approve and publish results?" description={`${className} · ${term}`}>
        <div className="px-6 pt-5">
          <p className="m-0 text-body leading-relaxed text-text-secondary">
            This publishes the reviewed results for students in this class and notifies parents. Confirm the values above are correct.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-5">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
          >
            {pending ? "Publishing…" : "Publish results"}
          </button>
        </div>
      </Modal>
    </>
  );
}

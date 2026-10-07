"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { buildErrorReport } from "@/lib/score-csv";
import { MAX_STUDENT_IMPORT_BYTES, buildStudentTemplate, parseStudentSheet, type StudentImportPreview } from "@/lib/student-csv";
import { importStudents } from "./actions";

type Props = {
  open: boolean;
  onClose: () => void;
  campuses: { id: string; name: string }[];
  classes: { id: string; name: string; campusId: string }[];
  /** Every code already in the school, so the preview can flag clashes before anything is sent. */
  existingCodes: string[];
};

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const secondary = "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary hover:bg-bg-page";
const primary = "inline-flex h-9 items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover disabled:opacity-60";

export function ImportStudentsDialog({ open, onClose, campuses, classes, existingCodes }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; classesCreated: number } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const existing = useMemo(() => new Set(existingCodes.map((c) => c.toLowerCase())), [existingCodes]);
  const preview: StudentImportPreview | null = useMemo(() => (csv === null ? null : parseStudentSheet(csv, { campuses, classes, existingCodes: existing })), [csv, campuses, classes, existing]);

  function reset() {
    setCsv(null);
    setFileName("");
    setFileError(null);
    setServerError(null);
    setDone(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setServerError(null);
    setFileError(null);
    if (file.size > MAX_STUDENT_IMPORT_BYTES) {
      setFileError("That file is too large to import (limit 2 MB).");
      return;
    }
    if (/\.xlsx?$/i.test(file.name)) {
      setFileError("Save the spreadsheet as CSV first (in Excel: File → Save As → CSV), then choose that file.");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
    if (fileInput.current) fileInput.current.value = "";
  }

  function confirm() {
    if (csv === null) return;
    setServerError(null);
    startTransition(async () => {
      const result = await importStudents(csv);
      if (result.ok) setDone({ created: result.created, classesCreated: result.classesCreated });
      else setServerError(result.error);
    });
  }

  const problems = preview?.errors.length ?? 0;
  const ready = preview?.rows.length ?? 0;

  return (
    <Modal open={open} onClose={close} title="Import students" description="Add many students at once from a spreadsheet saved as CSV." width={680}>
      <div className="grid gap-4 p-6">
        {done ? (
          <>
            <p className="m-0 rounded-md bg-success-bg px-3 py-2 text-body text-success">
              {done.created} student{done.created === 1 ? "" : "s"} added
              {done.classesCreated > 0 ? ` and ${done.classesCreated} new class${done.classesCreated === 1 ? "" : "es"} created` : ""}.
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={close} className={primary}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className="m-0 grid gap-1.5 pl-5 text-caption text-text-secondary">
              <li>Download the template and fill in one row per student. Student code, first name and last name are required.</li>
              <li>
                {campuses.length > 1 ? `Campus must match one of: ${campuses.map((c) => c.name).join(", ")}. ` : ""}A class that doesn&apos;t exist yet is created for you.
              </li>
              <li>Dates can be written 2014-09-30 or 30/09/2014. Save the file as CSV and choose it below.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => downloadText("students-template.csv", buildStudentTemplate())} className={secondary}>
                <Download size={14} strokeWidth={1.8} />
                Download template
              </button>
              <button type="button" onClick={() => fileInput.current?.click()} className={secondary}>
                <Upload size={14} strokeWidth={1.8} />
                {csv === null ? "Choose CSV file" : "Choose a different file"}
              </button>
              <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" aria-label="Choose a CSV file of students" onChange={(e) => void pick(e.target.files?.[0])} />
              {fileName && <span className="text-caption text-text-muted">{fileName}</span>}
            </div>

            {fileError && <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{fileError}</p>}

            {preview && (
              <>
                {problems === 0 ? (
                  <p className="m-0 rounded-md bg-success-bg px-3 py-2 text-caption text-success">
                    {ready} student{ready === 1 ? "" : "s"} ready to add.
                    {preview.newClasses.length > 0 && ` New class${preview.newClasses.length === 1 ? "" : "es"} to create: ${preview.newClasses.slice(0, 8).join(", ")}${preview.newClasses.length > 8 ? "…" : ""}.`}
                  </p>
                ) : (
                  <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">
                    {problems} problem{problems === 1 ? "" : "s"} found in {preview.totalRows} row{preview.totalRows === 1 ? "" : "s"}. Nothing is added until the file is fixed. Correct it and choose it again.
                  </p>
                )}
                {preview.unknownColumns.length > 0 && (
                  <p className="m-0 rounded-md bg-warning-bg px-3 py-2 text-caption text-warning">
                    Ignored columns I don&apos;t recognise: {preview.unknownColumns.slice(0, 6).join(", ")}
                    {preview.unknownColumns.length > 6 ? "…" : ""}
                  </p>
                )}
                {problems > 0 && (
                  <div className="max-h-[240px] overflow-auto rounded-md border border-border">
                    <table className="w-full border-collapse text-left text-caption">
                      <thead className="bg-[#fafbfb]">
                        <tr>
                          {["Row", "Student code", "Column", "Problem"].map((h) => (
                            <th key={h} className="border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.errors.slice(0, 100).map((e, i) => (
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
              </>
            )}

            {serverError && <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{serverError}</p>}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {problems > 0 && (
                <button type="button" onClick={() => downloadText("student-import-errors.csv", buildErrorReport(preview!.errors))} className={secondary}>
                  Download error report
                </button>
              )}
              <button type="button" onClick={close} className={secondary}>
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={pending || problems > 0 || ready === 0} className={primary}>
                {pending ? "Adding…" : ready > 0 ? `Add ${ready} student${ready === 1 ? "" : "s"}` : "Add students"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

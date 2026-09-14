"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { createCampus, createStudent } from "./actions";

type Campus = { id: string; name: string };
type ClassOption = { id: string; name: string };
type Student = {
  id: string;
  name: string;
  studentCode: string;
  className: string;
  classId: string | null;
  campusName: string;
  campusId: string;
  guardianName: string | null;
  guardianPhone: string | null;
  isActive: boolean;
};

type StudentsClientProps = {
  campuses: Campus[];
  classes: ClassOption[];
  students: Student[];
};

const ALL = "all";

export function StudentsClient({ campuses, classes, students }: StudentsClientProps) {
  const [campusFilter, setCampusFilter] = useState(ALL);
  const [classFilter, setClassFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [addOpen, setAddOpen] = useState(false);
  const [campusModalOpen, setCampusModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          (campusFilter === ALL || s.campusId === campusFilter) &&
          (classFilter === ALL || s.classId === classFilter) &&
          (statusFilter === ALL || (statusFilter === "active") === s.isActive),
      ),
    [students, campusFilter, classFilter, statusFilter],
  );

  function handleAddStudent(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createStudent(formData);
        setAddOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add student.");
      }
    });
  }

  function handleAddCampus(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createCampus(formData);
        setCampusModalOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add campus.");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader eyebrow="School management" title="Students" />
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              aria-label="Select campus"
              className="h-9 max-w-[190px] rounded-md border border-border bg-primary-bg px-2.5 text-caption font-medium text-primary"
            >
              <option value={ALL}>All campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-body text-text-muted">Manage student records across every campus in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCampusModalOpen(true)}
            className="inline-flex h-[39px] items-center gap-2 rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary hover:bg-bg-page"
          >
            <Building2 size={16} strokeWidth={1.8} />
            New campus
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-[39px] items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover"
          >
            <Plus size={16} strokeWidth={1.8} />
            Add student
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-border bg-bg-card px-5 py-4">
        <span className="text-caption text-text-muted">Filter students</span>
        <div className="flex items-center gap-2">
          <label htmlFor="class-filter" className="text-caption text-text-secondary">
            Class
          </label>
          <select
            id="class-filter"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-[35px] min-w-[135px] rounded-md border border-border bg-bg-card px-2.5 text-caption text-text-primary"
          >
            <option value={ALL}>All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-caption text-text-secondary">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-[35px] min-w-[135px] rounded-md border border-border bg-bg-card px-2.5 text-caption text-text-primary"
          >
            <option value={ALL}>All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setClassFilter(ALL);
            setStatusFilter(ALL);
          }}
          className="ml-auto border-0 bg-transparent p-2 text-caption font-medium text-primary"
        >
          Clear filters
        </button>
      </div>

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Student directory</h2>
            <p className="mt-1.5 text-caption text-text-muted">Student records for the selected campus</p>
          </div>
          <span className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption text-text-secondary">
            {filtered.length} {filtered.length === 1 ? "student" : "students"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[830px] border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Student name", "Student ID/code", "Class", "Campus", "Parent contact", "Status"].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-body text-text-muted">
                    No students match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfd]">
                    <td className="px-4 py-4 pl-5">
                      <div className="flex min-w-[190px] items-center gap-3">
                        <span className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-primary-bg text-caption font-medium text-primary">
                          {s.name
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                        <strong className="text-body font-medium text-text-primary">{s.name}</strong>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-body tabular-nums text-text-secondary">{s.studentCode}</td>
                    <td className="px-4 py-4 text-body text-text-secondary">{s.className}</td>
                    <td className="px-4 py-4 text-body text-text-secondary">{s.campusName}</td>
                    <td className="px-4 py-4">
                      <span className="block text-body text-text-primary">{s.guardianName ?? "—"}</span>
                      {s.guardianPhone && <span className="mt-1 block text-caption text-text-muted">{s.guardianPhone}</span>}
                    </td>
                    <td className="px-4 py-4 pr-5">
                      <StatusPill label={s.isActive ? "Active" : "Inactive"} tone={s.isActive ? "success" : "neutral"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-4 text-caption text-text-muted">
          Showing {filtered.length} of {students.length} student records
        </div>
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add student" description="Enter a new student record.">
        <form action={handleAddStudent} className="contents">
          <div className="grid grid-cols-2 gap-4 px-6 pt-5">
            <Field label="Student first name">
              <input name="firstName" required placeholder="First name" className={inputClass} />
            </Field>
            <Field label="Student last name">
              <input name="lastName" required placeholder="Last name" className={inputClass} />
            </Field>
            <Field label="Student ID/code">
              <input name="studentCode" required placeholder="e.g. GI-2026-113" className={inputClass} />
            </Field>
            <Field label="Campus">
              <select name="campusId" required defaultValue={campuses[0]?.id} className={inputClass}>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Class">
              <select name="classId" defaultValue="" className={inputClass}>
                <option value="">No class yet</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Or add a new class">
              <input name="newClassName" placeholder="e.g. JSS 1B" className={inputClass} />
            </Field>
            <Field label="Parent/guardian name">
              <input name="guardianName" placeholder="Full name" className={inputClass} />
            </Field>
            <Field label="Parent/guardian phone">
              <input name="guardianPhone" placeholder="+234 800 000 0000" className={inputClass} />
            </Field>
            <Field label="Parent/guardian email">
              <input name="guardianEmail" type="email" placeholder="parent@example.com" className={inputClass} />
            </Field>
          </div>
          {error && <p className="mx-6 mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          <div className="flex justify-end gap-2 px-6 py-5">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add student"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={campusModalOpen} onClose={() => setCampusModalOpen(false)} title="Add campus" description="Create a new campus for this school.">
        <form action={handleAddCampus} className="contents">
          <div className="grid gap-4 px-6 pt-5">
            <Field label="Campus name">
              <input name="name" required placeholder="e.g. GRA campus" className={inputClass} />
            </Field>
            <Field label="Address (optional)">
              <input name="address" placeholder="Street, city" className={inputClass} />
            </Field>
          </div>
          {error && <p className="mx-6 mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          <div className="flex justify-end gap-2 px-6 py-5">
            <button
              type="button"
              onClick={() => setCampusModalOpen(false)}
              className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add campus"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

const inputClass = "h-[38px] min-w-0 rounded-md border border-border bg-bg-card px-2.5 text-body text-text-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-caption text-text-secondary">
      {label}
      {children}
    </label>
  );
}

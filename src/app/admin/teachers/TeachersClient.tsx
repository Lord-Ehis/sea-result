"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { inviteTeacher, updateTeacherAssignments, setTeacherActive } from "./actions";

type ClassOption = { id: string; name: string };
type Teacher = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  classIds: string[];
  classNames: string[];
};

export function TeachersClient({ classes, teachers }: { classes: ClassOption[]; teachers: Teacher[] }) {
  const [query, setQuery] = useState("");
  const [modalTeacher, setModalTeacher] = useState<Teacher | "new" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => `${t.name} ${t.email} ${t.classNames.join(" ")}`.toLowerCase().includes(q));
  }, [teachers, query]);

  function openInvite() {
    setModalTeacher("new");
    setName("");
    setEmail("");
    setSelectedClassIds([]);
    setError(null);
  }

  function openEdit(t: Teacher) {
    setModalTeacher(t);
    setName(t.name);
    setEmail(t.email);
    setSelectedClassIds(t.classIds);
    setError(null);
  }

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) => (prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedClassIds.length === 0) {
      setError("Select at least one class.");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        if (modalTeacher === "new") {
          await inviteTeacher({ name, email, classIds: selectedClassIds });
          setMessage(`Invite sent to ${email}.`);
        } else if (modalTeacher) {
          await updateTeacherAssignments({ teacherId: modalTeacher.id, classIds: selectedClassIds });
          setMessage("Assignments updated.");
        }
        setModalTeacher(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleToggleActive(t: Teacher) {
    setError(null);
    startTransition(async () => {
      try {
        await setTeacherActive(t.id, !t.isActive);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update teacher.");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="School management" title="Teachers" intro="Manage staff invitations and class assignments across your school." />
        <div className="flex items-center gap-2">
          <label className="flex h-[39px] min-w-[220px] items-center gap-2 rounded-md border border-border bg-bg-card px-3">
            <Search size={16} strokeWidth={1.8} className="text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teachers…"
              aria-label="Search teachers"
              className="min-w-0 flex-1 border-0 bg-transparent text-caption text-text-primary outline-none"
            />
          </label>
          <button
            type="button"
            onClick={openInvite}
            className="inline-flex h-[39px] items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover"
          >
            <Plus size={16} strokeWidth={1.8} />
            Invite teacher
          </button>
        </div>
      </div>

      {message && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Teaching staff</h2>
            <p className="mt-1.5 text-caption text-text-muted">Teachers with access to results management</p>
          </div>
          <span className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption text-text-secondary">
            {filtered.length} {filtered.length === 1 ? "teacher" : "teachers"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Teacher name", "Email", "Assigned classes", "Status", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-body text-text-muted">
                    No teachers match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-[#f0f2f3] last:border-0">
                    <td className="px-4 py-4 pl-5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-[33px] w-[33px] flex-none place-items-center rounded-md bg-primary-bg text-[10px] font-medium text-primary">
                          {t.name
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                        <strong className="text-body font-medium text-text-primary">{t.name}</strong>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-body text-text-secondary">{t.email}</td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[370px] flex-wrap gap-1.5">
                        {t.classNames.length === 0 ? (
                          <span className="text-caption text-text-muted">No classes assigned</span>
                        ) : (
                          t.classNames.map((name, i) => (
                            <span key={i} className="rounded-md border border-border bg-bg-page px-2 py-1 text-[10px] text-text-secondary">
                              {name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill label={t.isActive ? "Active" : "Inactive"} tone={t.isActive ? "success" : "neutral"} />
                    </td>
                    <td className="px-4 py-4 pr-5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-2.5 text-caption font-medium text-primary hover:bg-primary-bg"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(t)}
                          disabled={pending}
                          className="inline-flex h-8 items-center rounded-md border border-border bg-bg-card px-2.5 text-caption font-medium text-text-secondary disabled:opacity-60"
                        >
                          {t.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-4 text-caption text-text-muted">
          Showing {filtered.length} of {teachers.length} teachers
        </div>
      </section>

      <Modal
        open={modalTeacher !== null}
        onClose={() => setModalTeacher(null)}
        title={modalTeacher === "new" ? "Invite teacher" : "Edit assignments"}
        description={
          modalTeacher === "new"
            ? "Assign the classes this teacher will manage. Login details are emailed to them."
            : "Update this teacher's class access."
        }
      >
        <form onSubmit={handleSubmit} className="contents">
          <div className="grid gap-4 px-6 pt-5">
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Teacher name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={modalTeacher !== "new"}
                placeholder="Full name"
                className="h-[42px] rounded-md border border-border bg-bg-card px-3 text-body text-text-primary disabled:bg-bg-page disabled:text-text-muted"
              />
            </label>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Teacher email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={modalTeacher !== "new"}
                placeholder="teacher@school.example"
                className="h-[42px] rounded-md border border-border bg-bg-card px-3 text-body text-text-primary disabled:bg-bg-page disabled:text-text-muted"
              />
            </label>
            <div className="grid gap-2">
              <span className="text-caption font-medium text-text-secondary">Assign classes</span>
              <div className="grid max-h-[235px] gap-1 overflow-y-auto rounded-md border border-border p-1.5">
                {classes.length === 0 ? (
                  <p className="p-2.5 text-caption text-text-muted">No classes exist yet.</p>
                ) : (
                  classes.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md p-2.5 text-caption text-text-secondary hover:bg-bg-page">
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(c.id)}
                        onChange={() => toggleClass(c.id)}
                        className="h-[15px] w-[15px] accent-primary"
                      />
                      {c.name}
                    </label>
                  ))
                )}
              </div>
              <p className="m-0 text-caption text-text-muted">Select one or more classes. You can change these later.</p>
            </div>
          </div>
          {error && <p className="mx-6 mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          <div className="flex justify-end gap-2 px-6 py-5">
            <button
              type="button"
              onClick={() => setModalTeacher(null)}
              className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || selectedClassIds.length === 0}
              className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-45"
            >
              {pending ? "Saving…" : modalTeacher === "new" ? "Send invite" : "Save assignments"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

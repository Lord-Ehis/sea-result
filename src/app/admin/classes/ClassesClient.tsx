"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Layers, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { defaultSessionLabel } from "@/lib/academic-term";
import { createClasses, updateClass, deleteClass } from "./actions";

type Campus = { id: string; name: string };
type ClassRow = {
  id: string;
  name: string;
  level: string | null;
  session: string;
  campusId: string;
  campusName: string;
  studentCount: number;
};

function splitArms(arms: string) {
  return arms
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

export function ClassesClient({ campuses, classes }: { campuses: Campus[]; classes: ClassRow[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [level, setLevel] = useState("");
  const [arms, setArms] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [sessionLabel, setSessionLabel] = useState(defaultSessionLabel());

  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editCampusId, setEditCampusId] = useState("");
  const [editSession, setEditSession] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const armList = splitArms(arms);
    const trimmedLevel = level.trim();
    if (!trimmedLevel) return [];
    return armList.length > 0 ? armList.map((a) => `${trimmedLevel} ${a}`) : [trimmedLevel];
  }, [level, arms]);

  const grouped = useMemo(() => {
    const map = new Map<string, ClassRow[]>();
    for (const c of classes) {
      const key = c.level?.trim() || "No level set";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries());
  }, [classes]);

  function openAdd() {
    setError(null);
    setLevel("");
    setArms("");
    setCampusId(campuses[0]?.id ?? "");
    setSessionLabel(defaultSessionLabel());
    setAddOpen(true);
  }

  function openEdit(c: ClassRow) {
    setError(null);
    setEditing(c);
    setEditName(c.name);
    setEditLevel(c.level ?? "");
    setEditCampusId(c.campusId);
    setEditSession(c.session);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await createClasses({ level, arms, campusId, session: sessionLabel });
        setMessage(`Added ${preview.length} class${preview.length === 1 ? "" : "es"}.`);
        setAddOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create these classes.");
      }
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateClass({ classId: editing.id, name: editName, level: editLevel, campusId: editCampusId, session: editSession });
        setEditing(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update this class.");
      }
    });
  }

  function handleDelete(c: ClassRow) {
    if (!window.confirm(`Delete ${c.name}? This can't be undone.`)) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await deleteClass(c.id);
        setMessage(`${c.name} deleted.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete this class.");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="School management" title="Classes" intro="Set up the classes and levels your school uses." />
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-[39px] items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={16} strokeWidth={1.8} />
          Add classes
        </button>
      </div>

      {message && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}
      {error && !addOpen && !editing && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      {classes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No classes yet"
          description="Add a level (e.g. JSS 1) and, if your school streams into arms, list them — A, B, C or Gold, Ruby, Emerald, whatever you use."
        />
      ) : (
        <div className="grid gap-4">
          {grouped.map(([levelKey, rows]) => (
            <section key={levelKey} className="overflow-hidden rounded-md border border-border bg-bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2 className="m-0 text-heading font-medium text-text-primary">{levelKey}</h2>
                <span className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption text-text-secondary">
                  {rows.length} {rows.length === 1 ? "class" : "classes"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead className="bg-[#fafbfb]">
                    <tr>
                      {["Class", "Campus", "Session", "Students", ""].map((h) => (
                        <th key={h} className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.id} className="border-b border-[#f0f2f3] last:border-0">
                        <td className="px-4 py-3.5 pl-5 text-body font-medium text-text-primary">{c.name}</td>
                        <td className="px-4 py-3.5 text-body text-text-secondary">{c.campusName}</td>
                        <td className="px-4 py-3.5 text-body text-text-secondary">{c.session}</td>
                        <td className="px-4 py-3.5 text-body text-text-secondary">{c.studentCount}</td>
                        <td className="px-4 py-3.5 pr-5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              aria-label={`Edit ${c.name}`}
                              className="grid h-8 w-8 place-items-center rounded-md text-text-secondary hover:bg-bg-page"
                            >
                              <Pencil size={14} strokeWidth={1.8} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              disabled={pending}
                              aria-label={`Delete ${c.name}`}
                              className="grid h-8 w-8 place-items-center rounded-md text-text-secondary hover:bg-danger-bg hover:text-danger disabled:opacity-60"
                            >
                              <Trash2 size={14} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add classes" description="Create one class, or a whole set of streamed arms at once.">
        <form onSubmit={handleCreate} className="contents">
          <div className="grid gap-4 px-6 pt-5">
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Level
              <input
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. JSS 1"
                required
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Arms <span className="font-normal text-text-muted">(optional — leave blank for a single class)</span>
              <input
                value={arms}
                onChange={(e) => setArms(e.target.value)}
                placeholder="A, B, C  or  Gold, Ruby, Emerald"
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Campus
                <select
                  value={campusId}
                  onChange={(e) => setCampusId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Academic session
                <input
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  required
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                />
              </label>
            </div>
            {preview.length > 0 && (
              <div>
                <p className="m-0 mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">Will create</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.map((name) => (
                    <span key={name} className="rounded-md border border-primary/30 bg-primary-bg px-2.5 py-1 text-caption text-primary">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
              disabled={pending || preview.length === 0}
              className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-45"
            >
              {pending ? "Creating…" : preview.length > 1 ? `Add ${preview.length} classes` : "Add class"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit class">
        <form onSubmit={handleUpdate} className="contents">
          <div className="grid gap-4 px-6 pt-5">
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Class name
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Level
              <input
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value)}
                required
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Campus
                <select
                  value={editCampusId}
                  onChange={(e) => setEditCampusId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Academic session
                <input
                  value={editSession}
                  onChange={(e) => setEditSession(e.target.value)}
                  required
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                />
              </label>
            </div>
          </div>
          {error && <p className="mx-6 mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          <div className="flex justify-end gap-2 px-6 py-5">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

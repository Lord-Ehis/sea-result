"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { inviteCampusAdmin, setCampusAdminActive, updateCampusAdminAccess } from "./actions";

type Campus = { id: string; name: string };
type Admin = { id: string; name: string; email: string; isActive: boolean; campusScoped: boolean; campusIds: string[] };

const inputClass = "h-10 w-full rounded-md border border-border bg-bg-card px-3 text-body text-text-primary";

export function TeamClient({ campuses, admins }: { campuses: Campus[]; admins: Admin[] }) {
  const [modal, setModal] = useState<Admin | "new" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const campusName = (id: string) => campuses.find((c) => c.id === id)?.name ?? "Unknown campus";

  function openInvite() {
    setModal("new");
    setName("");
    setEmail("");
    setSelected([]);
    setError(null);
  }

  function openEdit(a: Admin) {
    setModal(a);
    setSelected(a.campusIds);
    setError(null);
  }

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError("Choose at least one campus.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = modal === "new" ? await inviteCampusAdmin({ name, email, campusIds: selected }) : await updateCampusAdminAccess({ userId: (modal as Admin).id, campusIds: selected });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(modal === "new" ? `Invitation sent to ${email}.` : "Campus access updated.");
      setModal(null);
    });
  }

  function toggleActive(a: Admin) {
    setMessage(null);
    startTransition(async () => {
      const result = await setCampusAdminActive(a.id, !a.isActive);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="School management"
          title="Team"
          intro="Campus admins run day-to-day work for the campuses you choose — students, classes, teachers and results — but never school-wide settings."
        />
        <button
          type="button"
          onClick={openInvite}
          disabled={campuses.length === 0}
          className="inline-flex h-[39px] items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={1.8} />
          Invite campus admin
        </button>
      </div>

      {message && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}
      {error && modal === null && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Name", "Role", "Campuses", "Status", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-[#f0f2f3] last:border-0">
                  <td className="px-4 py-3.5 pl-5">
                    <strong className="block text-body font-medium text-text-primary">{a.name}</strong>
                    <span className="text-caption text-text-muted">{a.email}</span>
                  </td>
                  <td className="px-4 py-3.5 text-body text-text-secondary">{a.campusScoped ? "Campus admin" : "School admin"}</td>
                  <td className="px-4 py-3.5 text-body text-text-secondary">
                    {a.campusScoped ? (a.campusIds.length > 0 ? a.campusIds.map(campusName).join(", ") : "None — no access") : "All campuses"}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusPill label={a.isActive ? "Active" : "Switched off"} tone={a.isActive ? "success" : "neutral"} />
                  </td>
                  <td className="px-4 py-3.5 pr-5 text-right">
                    {a.campusScoped && (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg"
                        >
                          Change campuses
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(a)}
                          disabled={pending}
                          className="inline-flex h-8 items-center rounded-md border border-border bg-bg-card px-3 text-caption font-medium text-text-secondary hover:bg-bg-page disabled:opacity-50"
                        >
                          {a.isActive ? "Switch off" : "Switch on"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? "Invite a campus admin" : "Change campus access"}
        description={modal === "new" ? "They get an email to set a password, and see only the campuses you choose." : modal ? (modal as Admin).name : undefined}
      >
        <form onSubmit={submit} className="grid gap-4 p-6">
          {error && <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          {modal === "new" && (
            <>
              <label className="grid gap-1.5 text-caption text-text-secondary">
                Full name
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
              </label>
              <label className="grid gap-1.5 text-caption text-text-secondary">
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
              </label>
            </>
          )}
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-1 text-caption text-text-secondary">Campuses they can access</legend>
            {campuses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-body text-text-primary">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60">
              {pending ? "Saving…" : modal === "new" ? "Send invitation" : "Save access"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

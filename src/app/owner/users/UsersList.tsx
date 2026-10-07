"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChangeEmailDialog, type EmailChangePerson } from "@/components/ui/ChangeEmailDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { changeUserEmailAsOwner, sendPasswordLink } from "./actions";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "SCHOOL_ADMIN" | "TEACHER" | "PARENT";
  isActive: boolean;
  createdAt: string;
  schoolId: string;
  schoolName: string;
};

const ROLE_LABEL: Record<UserRow["role"], string> = { SCHOOL_ADMIN: "School admin", TEACHER: "Teacher", PARENT: "Parent" };

const buttonClass =
  "inline-flex h-8 items-center rounded-md border border-border bg-bg-card px-2.5 text-caption font-medium text-text-secondary hover:bg-bg-page disabled:opacity-60";

export function UsersList({ users }: { users: UserRow[] }) {
  const [emailTarget, setEmailTarget] = useState<EmailChangePerson | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function send(user: UserRow) {
    setMessage(null);
    setConfirmId(null);
    startTransition(async () => {
      const result = await sendPasswordLink(user.id);
      if (!result.ok) setMessage({ ok: false, text: result.error });
      else if (result.delivered) setMessage({ ok: true, text: `A link to set a new password was emailed to ${user.email}.` });
      else setMessage({ ok: false, text: `The link was created, but the email to ${user.email} could not be sent. Check the email provider in Global settings.` });
    });
  }

  return (
    <>
      {message && <p className={`mb-4 rounded-md px-3 py-2 text-caption ${message.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{message.text}</p>}

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f2f3] px-5 py-4 last:border-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-body font-medium text-text-primary">{u.name}</strong>
                <StatusPill label={ROLE_LABEL[u.role]} tone="neutral" />
                {!u.isActive && <StatusPill label="Switched off" tone="warning" />}
              </div>
              <div className="break-all text-caption text-text-secondary">{u.email}</div>
              <div className="text-caption text-text-muted">
                <Link href={`/owner/schools/${u.schoolId}`} className="text-primary hover:underline">
                  {u.schoolName}
                </Link>{" "}
                · Joined {new Date(u.createdAt).toLocaleDateString("en-GB")}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {confirmId === u.id ? (
                <>
                  <span className="text-caption text-text-muted">Email a password link to {u.email}?</span>
                  <button type="button" onClick={() => send(u)} disabled={pending} className="inline-flex h-8 items-center rounded-md border border-primary bg-primary px-2.5 text-caption font-medium text-white disabled:opacity-60">
                    Send
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)} className={buttonClass}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setConfirmId(u.id)} disabled={pending || !u.isActive} className={buttonClass}>
                    Send password link
                  </button>
                  <button type="button" onClick={() => setEmailTarget({ id: u.id, name: u.name, email: u.email })} disabled={pending} className={buttonClass}>
                    Change email
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </section>

      <ChangeEmailDialog
        key={emailTarget?.id ?? "none"}
        person={emailTarget}
        onClose={() => setEmailTarget(null)}
        onSubmit={(userId, email) => changeUserEmailAsOwner({ userId, email })}
        onDone={(text) => setMessage({ ok: true, text })}
      />
    </>
  );
}

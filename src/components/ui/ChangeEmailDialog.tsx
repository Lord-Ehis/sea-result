"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import type { ActionResult } from "@/lib/user-error";

export type EmailChangeResult = ActionResult<{ linkSent: boolean; email: string }>;
export type EmailChangePerson = { id: string; name: string; email: string };

// Recovery for someone who has lost access to their inbox. Render with
// `key={person?.id}` so each person starts with a clean form.
export function ChangeEmailDialog({
  person,
  onClose,
  onSubmit,
  onDone,
}: {
  person: EmailChangePerson | null;
  onClose: () => void;
  onSubmit: (userId: string, email: string) => Promise<EmailChangeResult>;
  onDone: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(person.id, email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(
        result.linkSent
          ? `Sign-in email changed to ${result.email}. A link to set a new password has been sent there.`
          : `Sign-in email changed to ${result.email}, but the email with the password link could not be sent. Ask ${person.name} to use "Forgot password" with the new address.`,
      );
      onClose();
    });
  }

  return (
    <Modal
      open={person !== null}
      onClose={onClose}
      title="Change sign-in email"
      description={person ? `${person.name} · currently ${person.email}` : undefined}
    >
      <form onSubmit={submit} className="grid gap-4 p-6">
        <p className="m-0 rounded-md bg-bg-page px-3 py-2.5 text-caption leading-relaxed text-text-secondary">
          Only do this when the person can no longer open the inbox above, and you are sure it is really them asking. They will get a link at the new address to set a
          password, and a notice goes to the old address.
        </p>
        {error && <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
        <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
          New email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="name@example.com"
            className="h-[42px] rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60">
            {pending ? "Changing…" : "Change email"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

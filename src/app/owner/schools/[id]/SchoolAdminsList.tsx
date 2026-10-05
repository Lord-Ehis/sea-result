"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { ChangeEmailDialog } from "@/components/ui/ChangeEmailDialog";
import { changeSchoolAdminEmail } from "../actions";

type Admin = { id: string; name: string; email: string };

export function SchoolAdminsList({ admins }: { admins: Admin[] }) {
  const [target, setTarget] = useState<Admin | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      {message && <p className="m-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}
      <div className="divide-y divide-[#f0f2f3]">
        {admins.length === 0 ? (
          <p className="px-5 py-6 text-body text-text-muted">No admin account yet.</p>
        ) : (
          admins.map((u) => (
            <div key={u.id} className="flex items-center gap-2.5 px-5 py-4">
              <span className="grid h-[33px] w-[33px] flex-none place-items-center rounded-md bg-primary-bg text-[10px] font-medium text-primary">
                {u.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-body font-medium text-text-primary">{u.name}</strong>
                <span className="flex items-center gap-1 text-caption text-text-muted">
                  <Mail size={12} strokeWidth={1.8} />
                  <span className="truncate">{u.email}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setTarget(u);
                }}
                className="inline-flex h-8 flex-none items-center rounded-md border border-border bg-bg-card px-2.5 text-caption font-medium text-text-secondary hover:bg-bg-page"
              >
                Change email
              </button>
            </div>
          ))
        )}
      </div>
      <ChangeEmailDialog
        key={target?.id ?? "none"}
        person={target}
        onClose={() => setTarget(null)}
        onSubmit={(userId, email) => changeSchoolAdminEmail({ userId, email })}
        onDone={setMessage}
      />
    </>
  );
}

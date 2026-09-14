"use client";

import { useState, useTransition } from "react";
import { ShieldOff, ShieldCheck } from "lucide-react";
import { setSchoolStatus } from "../actions";

export function SchoolStatusToggle({ schoolId, status }: { schoolId: string; status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "PENDING_DELETION") return null;

  const isActive = status === "ACTIVE";

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      try {
        await setSchoolStatus(schoolId, isActive ? "SUSPENDED" : "ACTIVE");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update school status.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-caption font-medium disabled:opacity-60 ${
          isActive
            ? "border-danger/30 bg-danger-bg text-danger hover:bg-danger-bg/80"
            : "border-primary bg-primary text-white hover:bg-primary-hover"
        }`}
      >
        {isActive ? <ShieldOff size={15} strokeWidth={1.8} /> : <ShieldCheck size={15} strokeWidth={1.8} />}
        {pending ? "Updating…" : isActive ? "Suspend school" : "Reactivate school"}
      </button>
      {error && <p className="m-0 max-w-[220px] text-right text-caption text-danger">{error}</p>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Download, Trash2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { DataCounts } from "@/lib/school-data";
import { deleteSchoolData } from "../actions";

const inputClass = "h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary";

const LABELS: [keyof DataCounts, string][] = [
  ["students", "Students"],
  ["staff", "Staff"],
  ["parents", "Parents"],
  ["classes", "Classes"],
  ["results", "Results"],
  ["publishedResults", "Published results"],
  ["payments", "Payments"],
  ["messages", "Messages sent"],
];

export function SchoolDataPanel({ schoolId, schoolName, active, counts, paidTotal, twoStepOn }: { schoolId: string; schoolName: string; active: boolean; counts: DataCounts; paidTotal: number; twoStepOn: boolean }) {
  const router = useRouter();
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await deleteSchoolData({ schoolId, confirmName: typedName, password: String(data.get("password") ?? ""), code: String(data.get("code") ?? "") });
      if (r.ok) router.push(`/owner/schools?deleted=${encodeURIComponent(schoolName)}${r.filesFailed ? "&filesFailed=1" : ""}`);
      else setError(r.error);
    });
  }

  const nameMatches = typedName.trim() === schoolName;

  return (
    <section className="mb-7 overflow-hidden rounded-md border border-border bg-bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="m-0 text-heading font-medium text-text-primary">School data</h2>
        <p className="mt-1 mb-0 text-caption text-text-muted">Everything this school has stored on SEA. Download a copy, or remove it all permanently.</p>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
        {LABELS.map(([key, label]) => (
          <div key={key}>
            <dt className="text-[10px] text-text-muted">{label}</dt>
            <dd className="m-0 text-heading font-medium tabular-nums text-text-primary">{counts[key].toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        <a href={`/owner/schools/${schoolId}/export`} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary hover:bg-bg-page">
          <Download size={14} strokeWidth={1.8} />
          Download all data (ZIP)
        </a>
        <span className="text-caption text-text-muted">Spreadsheets of students, results, payments and more. Contains children&apos;s names and parents&apos; contacts, so keep it private. Each download is logged.</span>
      </div>

      <div className="border-t border-danger/30 bg-danger-bg/30 px-5 py-4">
        <h3 className="m-0 flex items-center gap-2 text-body font-medium text-danger">
          <Trash2 size={16} strokeWidth={1.8} />
          Delete all of this school&apos;s data
        </h3>
        {active ? (
          <p className="mt-2 mb-0 text-caption text-text-secondary">This school is active. Switch it off first (Suspend, above), then come back here to delete it.</p>
        ) : (
          <form onSubmit={remove} className="mt-3 grid gap-3">
            <p className="m-0 text-caption text-text-secondary">
              This permanently removes {counts.students.toLocaleString()} students, {counts.results.toLocaleString()} results, {counts.payments.toLocaleString()} payments, every staff and parent account, and the uploaded logo, stamp and photos. <strong className="font-medium">It cannot be undone.</strong>
              {paidTotal > 0 ? ` The school has paid ₦${paidTotal.toLocaleString()}; that amount is kept in your audit log, but the payment records are deleted. Download the data first if you need them.` : ""}
            </p>
            <label className="grid gap-1 text-[10px] text-text-muted">
              Type the school&apos;s exact name to confirm: <span className="font-medium text-text-primary">{schoolName}</span>
              <input value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" className={`${inputClass} max-w-md`} />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-[10px] text-text-muted">
                Your password
                <PasswordInput name="password" required autoComplete="current-password" className={`${inputClass} w-56`} />
              </label>
              {twoStepOn && (
                <label className="grid gap-1 text-[10px] text-text-muted">
                  Two-step code
                  <input name="code" required autoComplete="one-time-code" maxLength={16} placeholder="6-digit code" className={`${inputClass} w-40 tracking-widest`} />
                </label>
              )}
              <button type="submit" disabled={pending || !nameMatches} className="inline-flex h-10 items-center rounded-md border border-danger bg-danger px-4 text-caption font-medium text-white disabled:opacity-50">
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
            {error && <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          </form>
        )}
      </div>
    </section>
  );
}

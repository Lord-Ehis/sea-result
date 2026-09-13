"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { linkChild } from "./actions";

export function LinkChildForm() {
  const [studentCode, setStudentCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<{ name: string; className: string | null; campusName: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await linkChild({ studentCode, fullName });
      setLinked(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link child.");
    } finally {
      setLoading(false);
    }
  }

  if (linked) {
    return (
      <div className="max-w-[440px] rounded-md border border-border bg-bg-card p-8 text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-md bg-success-bg text-success">
          <Check size={24} strokeWidth={2} />
        </span>
        <h2 className="m-0 mb-2 text-heading font-medium text-text-primary">Child added to your dashboard</h2>
        <p className="m-0 mb-5 text-body text-text-muted">
          The student details matched. You can now see their published results alongside your other children.
        </p>
        <div className="mb-5 flex items-center gap-3 rounded-md border border-border bg-bg-page p-3 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-success-bg text-caption font-medium text-success">
            {linked.name[0]}
          </span>
          <span>
            <strong className="block text-body font-medium text-text-primary">{linked.name}</strong>
            <small className="block text-caption text-text-muted">
              {linked.className ?? "No class"} · {linked.campusName}
            </small>
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href="/parent/dashboard"
            className="flex-1 rounded-md border border-primary bg-primary px-4 py-2.5 text-center text-body font-medium text-white hover:bg-primary-hover"
          >
            View dashboard
          </Link>
          <button
            type="button"
            onClick={() => {
              setLinked(null);
              setStudentCode("");
              setFullName("");
            }}
            className="rounded-md border border-border bg-bg-card px-4 py-2.5 text-body font-medium text-text-secondary hover:bg-bg-page"
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[440px] rounded-md border border-border bg-bg-card p-6">
      <div className="grid gap-4">
        {error && <p className="rounded-sm border border-danger/30 bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
        <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
          Student ID/code
          <input
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
            placeholder="Enter student code"
            autoComplete="off"
            spellCheck={false}
            required
            className="h-11 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
          />
        </label>
        <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
          Student&apos;s full name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter full name"
            autoComplete="name"
            required
            className="h-11 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
          />
        </label>
        <p className="m-0 text-caption text-text-muted">Your school will share the student code with you.</p>
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-md border border-primary bg-primary text-body font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? "Checking…" : "Link child"}
        </button>
      </div>
    </form>
  );
}

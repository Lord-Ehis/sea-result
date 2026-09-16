"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { lookupStudentResult, type LookupResult } from "./actions";
import { ComparisonReport } from "@/components/results/ComparisonReport";

export function LookupForm({ schoolName, slug }: { schoolName: string; slug: string }) {
  const [studentCode, setStudentCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [comparingTemplateId, setComparingTemplateId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Groups every published result by template, preserving the query's own
  // publishedAt-desc order within each group (newest term first).
  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<LookupResult["results"]>>();
    for (const r of result?.results ?? []) {
      if (!map.has(r.templateId)) map.set(r.templateId, []);
      map.get(r.templateId)!.push(r);
    }
    return Array.from(map.values());
  }, [result]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const outcome = await lookupStudentResult({ slug, studentCode, fullName });
      setResult(outcome);
    });
  }

  const initials = schoolName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4 py-10">
      <div className="w-full max-w-[440px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="grid h-[55px] w-[55px] place-items-center rounded-md border border-dashed border-primary/40 bg-primary-bg text-heading font-medium tracking-tight text-primary">
            {initials}
          </span>
          <span className="mt-3 text-caption font-medium text-text-secondary">{schoolName}</span>
          <h1 className="mt-5 mb-0 text-title font-medium leading-tight tracking-tight text-text-primary">Check student result</h1>
          <p className="mt-2 mb-0 text-body text-text-muted">Enter the student&apos;s details to continue.</p>
        </div>

        {!result?.found && (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="grid gap-2 text-caption font-medium text-text-secondary">
              Student ID/code
              <input
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="Enter student code"
                autoComplete="off"
                spellCheck={false}
                required
                className="h-12 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-2 text-caption font-medium text-text-secondary">
              Student&apos;s full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                autoComplete="name"
                required
                className="h-12 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="mt-1 h-12 rounded-md border border-primary bg-primary text-body font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? "Checking…" : "View result"}
            </button>
          </form>
        )}

        {result && !result.found && (
          <p className="mt-1 rounded-md border border-primary/20 bg-primary-bg px-3.5 py-3 text-caption leading-relaxed text-primary">
            No matching result found. Double-check the student code and full name, or contact your school.
          </p>
        )}

        {result?.found && (
          <div className="grid gap-4">
            <p className="m-0 rounded-md bg-success-bg px-3.5 py-3 text-caption text-success">
              Showing results for <strong>{result.studentName}</strong>.
            </p>
            {groups.length > 0 ? (
              groups.map((group, gi) => {
                const templateId = group[0].templateId;
                const comparing = comparingTemplateId === templateId;
                return (
                  <div key={gi} className="grid gap-3">
                    {group.map((r, i) => (
                      <div key={i} className="rounded-md border border-border bg-bg-page p-4">
                        <div className="mb-3 flex items-baseline justify-between gap-2">
                          <strong className="text-body font-medium text-text-primary">{r.templateName}</strong>
                          <span className="text-caption text-text-muted">{r.term ?? "Term not set"}</span>
                        </div>
                        <div className="grid gap-2">
                          {r.fields.map((f) => (
                            <div key={f.name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-card px-3 py-2.5">
                              <span className="text-caption text-text-muted">{f.name}</span>
                              <span className="text-body font-medium text-text-primary">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {group.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setComparingTemplateId(comparing ? null : templateId)}
                          className="h-9 rounded-md border border-border bg-bg-card text-caption font-medium text-primary hover:bg-primary-bg"
                        >
                          {comparing ? "Hide term comparison" : "Compare all terms"}
                        </button>
                        {comparing && <ComparisonReport terms={[...group].reverse()} />}
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="m-0 text-caption text-text-muted">No published results yet for this student.</p>
            )}
            <button
              type="button"
              onClick={() => setResult(null)}
              className="h-11 rounded-md border border-border bg-bg-card text-caption font-medium text-text-secondary hover:bg-bg-page"
            >
              Look up another student
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-caption text-text-muted">Your school will share the student code with you.</p>
        <p className="mt-2 text-center text-caption text-text-muted">
          Want to save this for every term?{" "}
          <Link href={`/signup/parent/${slug}`} className="font-medium text-primary hover:text-primary-hover">
            Create a parent account
          </Link>
        </p>
        <p className="mt-2 text-center text-caption">
          <Link href="/lookup" className="font-medium text-primary hover:text-primary-hover">
            Not your school?
          </Link>
        </p>
      </div>
    </div>
  );
}

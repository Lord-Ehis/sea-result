"use client";

import { useMemo, useState, useTransition } from "react";
import { DIGITS_MAX, DIGITS_MIN, PREFIX_MAX, SEPARATOR_CHOICES, YEAR_CHOICES, cleanPrefix, exampleCode, type StudentCodeSettings as Settings } from "@/lib/student-code";
import { saveStudentCodeSettings } from "./actions";

const inputClass = "h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary";

// The shape of the codes Sophie creates for new students. Everything here only
// affects students added from now on.
export function StudentCodeSettings({ initial }: { initial: Settings }) {
  const [auto, setAuto] = useState(initial.auto);
  const [prefix, setPrefix] = useState(initial.prefix);
  const [year, setYear] = useState<string>(initial.year);
  const [separator, setSeparator] = useState<string>(initial.separator);
  const [digits, setDigits] = useState(initial.digits);
  const [next, setNext] = useState(String(initial.next));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A live example, built with the same rules the server uses.
  const example = useMemo(() => {
    const n = Number(next);
    return exampleCode({ auto, prefix: cleanPrefix(prefix), year: year as Settings["year"], separator: separator as Settings["separator"], digits, next: Number.isInteger(n) && n > 0 ? n : 1 }, new Date());
  }, [auto, prefix, year, separator, digits, next]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const r = await saveStudentCodeSettings({ auto, prefix, year, separator, digits, next: Number(next) });
      if (r.ok) setSaved(auto ? `Saved. The next student will get ${r.example}.` : "Saved. Student codes are typed by hand.");
      else setError(r.error);
    });
  }

  return (
    <section className="mt-6 overflow-hidden rounded-md border border-border bg-bg-card">
      <div className="border-b border-border px-5 py-5">
        <h2 className="m-0 text-heading font-medium text-text-primary">Student ID numbers</h2>
        <p className="mt-1.5 text-caption text-text-muted">
          Every student has a unique code. Parents use it, with the child&apos;s full name, to find results. Let Sophie create the codes, or type your own.
        </p>
      </div>
      <form onSubmit={save} className="grid gap-4 p-5">
        <label className="flex items-start gap-3 text-body text-text-primary">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-1" />
          <span>
            Create student codes automatically
            <span className="block text-caption text-text-muted">When you add a student and leave the code empty, the next code is created for you. A code you type is always used as typed, so you can still use your own admission numbers.</span>
          </span>
        </label>

        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-5 ${auto ? "" : "opacity-50"}`}>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Prefix
            <input value={prefix} onChange={(e) => setPrefix(cleanPrefix(e.target.value))} maxLength={PREFIX_MAX} disabled={!auto} placeholder="e.g. GDA" className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Year
            <select value={year} onChange={(e) => setYear(e.target.value)} disabled={!auto} className={inputClass}>
              {YEAR_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Separator
            <select value={separator} onChange={(e) => setSeparator(e.target.value)} disabled={!auto} className={inputClass}>
              {SEPARATOR_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Number length
            <select value={digits} onChange={(e) => setDigits(Number(e.target.value))} disabled={!auto} className={inputClass}>
              {Array.from({ length: DIGITS_MAX - DIGITS_MIN + 1 }, (_, i) => DIGITS_MIN + i).map((d) => (
                <option key={d} value={d}>
                  {d} digits
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Next number
            <input value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} inputMode="numeric" disabled={!auto} className={inputClass} />
          </label>
        </div>

        <div className="rounded-md border border-border bg-bg-page px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">The next student&apos;s code will look like</div>
          <div className={`mt-1 font-mono text-heading font-medium tracking-wide ${auto ? "text-text-primary" : "text-text-muted"}`}>{auto ? example : "Codes are typed by hand"}</div>
        </div>
        <p className="m-0 text-caption text-text-muted">
          A new format only affects students added from now on. Codes already given never change. Numbers keep counting up and are never reused. Set &quot;Next number&quot; higher if you already have students and want to continue after them.
        </p>

        {error && <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
        {saved && <p className="m-0 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{saved}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white disabled:opacity-60">
            {pending ? "Saving…" : "Save student ID settings"}
          </button>
        </div>
      </form>
    </section>
  );
}

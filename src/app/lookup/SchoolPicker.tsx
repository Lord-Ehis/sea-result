"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type School = { name: string; slug: string };

export function SchoolPicker({ schools }: { schools: School[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = value.trim().toLowerCase();
    const match = schools.find((s) => s.name.toLowerCase() === query || s.slug.toLowerCase() === query);
    if (!match) {
      setError("We couldn't find that school. Check the spelling, or ask your school for their result lookup link.");
      return;
    }
    setError(null);
    router.push(`/lookup/${match.slug}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
        School name
        <input
          list="schools"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Start typing your school's name"
          required
          className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
        />
        <datalist id="schools">
          {schools.map((s) => (
            <option key={s.slug} value={s.name} />
          ))}
        </datalist>
      </label>
      {error && <p className="m-0 text-caption text-danger">{error}</p>}
      <button
        type="submit"
        className="rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover"
      >
        Continue
      </button>
    </form>
  );
}

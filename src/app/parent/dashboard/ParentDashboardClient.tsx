"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Plus, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type ResultEntry = {
  templateName: string;
  term: string | null;
  publishedAt: string | null;
  fields: { name: string; value: string }[];
};

type Child = {
  id: string;
  name: string;
  className: string;
  campusName: string;
  results: ResultEntry[];
};

export function ParentDashboardClient({ students }: { students: Child[] }) {
  const [selectedId, setSelectedId] = useState(students[0].id);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const selected = students.find((c) => c.id === selectedId)!;
  const recent = selected.results[0];

  function selectChild(id: string) {
    setSelectedId(id);
    setExpandedIndex(null);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Family portal" title="Your children's results" intro="See the latest published results and past terms for each child." />
        <Link
          href="/parent/link-child"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-primary hover:bg-primary-bg"
        >
          <Plus size={15} strokeWidth={1.8} />
          Add another child
        </Link>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {students.map((c) => (
          <button
            key={c.id}
            onClick={() => selectChild(c.id)}
            className={`flex min-w-[150px] items-center gap-2.5 whitespace-nowrap rounded-md border px-3.5 py-2.5 text-caption font-medium ${
              c.id === selectedId ? "border-[#b7d2e3] bg-primary-bg text-primary" : "border-border bg-bg-card text-text-secondary"
            }`}
          >
            <span className="grid h-[27px] w-[27px] place-items-center rounded-md bg-primary-bg text-caption text-primary">{c.name[0]}</span>
            {c.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <section className="mb-6 overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Most recent result</h2>
            <p className="mt-1.5 text-caption text-text-muted">{recent?.term ?? "No published results yet"}</p>
          </div>
          {recent && <span className="rounded-full bg-success-bg px-2.5 py-1.5 text-caption text-success">Published</span>}
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center gap-3.5">
            <span className="grid h-12 w-12 place-items-center rounded-md bg-primary-bg text-primary">
              <FileText size={22} strokeWidth={1.8} />
            </span>
            <div>
              <strong className="block text-body font-medium text-text-primary">{selected.name}</strong>
              <span className="mt-1 block text-caption text-text-muted">
                {selected.className} · {selected.campusName}
              </span>
            </div>
          </div>
          {recent ? (
            <div className="grid gap-2">
              {recent.fields.map((f) => (
                <div key={f.name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-page px-3.5 py-2.5">
                  <span className="text-caption text-text-muted">{f.name}</span>
                  <span className="text-body font-medium text-text-primary">{f.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-body text-text-muted">Results will appear here once the school publishes them.</p>
          )}
        </div>
      </section>

      {selected.results.length > 0 && (
        <>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="m-0 text-heading font-medium text-text-primary">Results history</h2>
            <span className="text-caption text-text-muted">Past terms</span>
          </div>
          <section className="overflow-hidden rounded-md border border-border bg-bg-card">
            {selected.results.map((r, i) => (
              <div key={i} className="border-b border-[#eef1f2] last:border-0">
                <button
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
                >
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-md bg-primary-bg text-primary">
                    <FileText size={16} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-body font-medium text-text-primary">{r.term ?? r.templateName}</strong>
                    <span className="mt-1 block text-caption text-text-muted">
                      {r.publishedAt ? `Published ${new Date(r.publishedAt).toLocaleDateString("en-GB")}` : "Published"}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.8}
                    className={`flex-none text-text-muted transition-transform ${expandedIndex === i ? "rotate-180" : ""}`}
                  />
                </button>
                {expandedIndex === i && (
                  <div className="grid gap-2 px-5 pb-4">
                    {r.fields.map((f) => (
                      <div key={f.name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-page px-3.5 py-2.5">
                        <span className="text-caption text-text-muted">{f.name}</span>
                        <span className="text-body font-medium text-text-primary">{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
      <p className="mt-4 text-caption text-text-muted">Results are published by the school after teacher and admin review.</p>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ComparisonReport } from "@/components/results/ComparisonReport";
import { GridResultTable } from "@/components/results/GridResultTable";
import { FieldValueRow } from "@/components/results/FieldValueRow";
import type { GridResultData } from "@/lib/grid-compute";
import type { AnnualSummaryPayload } from "@/lib/annual-summary";
import { AnnualSummaryTable } from "@/components/results/AnnualSummaryTable";

type ResultEntry = {
  templateId: string;
  templateName: string;
  term: string | null;
  session: string | null;
  publishedAt: string | null;
  snapshotId: string;
  verificationCode: string;
  // False if the frozen record no longer matches its checksum — its contents
  // are withheld rather than shown.
  intact: boolean;
  fields: { name: string; value: string }[];
  grids: GridResultData[];
  annual: AnnualSummaryPayload | null;
};

function ResultFooter({ r }: { r: ResultEntry }) {
  if (!r.intact) {
    return (
      <p className="m-0 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-caption text-warning">
        This result failed an automatic integrity check, so it can&apos;t be shown. Please contact your school.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-text-muted">
      <span>
        Verification code <strong className="font-mono text-text-secondary">{r.verificationCode}</strong>
      </span>
      <Link href={`/result/${r.snapshotId}/print`} target="_blank" className="font-medium text-primary hover:underline">
        Print / save as PDF
      </Link>
    </div>
  );
}

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
  const [comparingTemplateId, setComparingTemplateId] = useState<string | null>(null);
  const selected = students.find((c) => c.id === selectedId)!;
  const recent = selected.results[0];

  // Groups this child's results by template, preserving the query's own
  // publishedAt-desc order within each group (newest term first).
  const groups = useMemo(() => {
    const map = new Map<string, ResultEntry[]>();
    for (const r of selected.results) {
      if (!map.has(r.templateId)) map.set(r.templateId, []);
      map.get(r.templateId)!.push(r);
    }
    // Only templates with flat fields have anything for ComparisonReport to
    // show — a Grid-only template (its grid isn't part of this comparison)
    // would otherwise offer a "Compare all terms" button revealing nothing.
    return Array.from(map.values()).filter((g) => g.length > 1 && g[0].fields.length > 0);
  }, [selected]);

  function selectChild(id: string) {
    setSelectedId(id);
    setExpandedIndex(null);
    setComparingTemplateId(null);
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
            <p className="mt-1.5 text-caption text-text-muted">{recent ? `${recent.term ?? recent.templateName}${recent.session ? ` · ${recent.session}` : ""}` : "No published results yet"}</p>
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
            <div className="grid gap-3">
              {recent.fields.length > 0 && (
                <div className="grid gap-2">
                  {recent.fields.map((f) => (
                    <FieldValueRow key={f.name} name={f.name} value={f.value} background="page" />
                  ))}
                </div>
              )}
              {recent.grids.map((g, gi) => (
                <GridResultTable key={gi} grid={g} />
              ))}
              {recent.annual && <AnnualSummaryTable annual={recent.annual} />}
              <ResultFooter r={recent} />
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
                    <strong className="block text-body font-medium text-text-primary">{r.term ?? r.templateName}{r.session ? ` · ${r.session}` : ""}</strong>
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
                  <div className="grid gap-3 px-5 pb-4">
                    {r.fields.length > 0 && (
                      <div className="grid gap-2">
                        {r.fields.map((f) => (
                          <FieldValueRow key={f.name} name={f.name} value={f.value} background="page" />
                        ))}
                      </div>
                    )}
                    {r.grids.map((g, gi) => (
                      <GridResultTable key={gi} grid={g} />
                    ))}
                    {r.annual && <AnnualSummaryTable annual={r.annual} />}
                    <ResultFooter r={r} />
                  </div>
                )}
              </div>
            ))}
          </section>

          {groups.length > 0 && (
            <div className="mt-4 grid gap-3">
              {groups.map((group, gi) => {
                const templateId = group[0].templateId;
                const comparing = comparingTemplateId === templateId;
                return (
                  <div key={gi} className="grid gap-3">
                    <button
                      type="button"
                      onClick={() => setComparingTemplateId(comparing ? null : templateId)}
                      className="h-9 w-fit rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-primary hover:bg-primary-bg"
                    >
                      {comparing ? "Hide term comparison" : `Compare all terms · ${group[0].templateName}`}
                    </button>
                    {comparing && <ComparisonReport terms={[...group].reverse()} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <p className="mt-4 text-caption text-text-muted">Results are published by the school after teacher and admin review.</p>
    </>
  );
}

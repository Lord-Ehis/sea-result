"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";

type SchoolStatus = "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";

type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  createdAt: string;
  studentCount: number;
  campusCount: number;
  revenue: number;
  plan: { billingCycle: "PER_TERM" | "FULL_SESSION"; endDate: string } | null;
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

const STATUS_TONE: Record<SchoolStatus, "success" | "danger" | "warning"> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  PENDING_DELETION: "warning",
};

const STATUS_LABEL: Record<SchoolStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  PENDING_DELETION: "Pending deletion",
};

const TABS: { key: "ALL" | SchoolStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "PENDING_DELETION", label: "Pending deletion" },
];

export function SchoolsClient({ schools }: { schools: SchoolRow[] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"ALL" | SchoolStatus>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter((s) => {
      if (tab !== "ALL" && s.status !== tab) return false;
      if (!q) return true;
      return `${s.name} ${s.slug}`.toLowerCase().includes(q);
    });
  }, [schools, query, tab]);

  const totalRevenue = useMemo(() => schools.reduce((sum, s) => sum + s.revenue, 0), [schools]);

  if (schools.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Platform overview" title="Schools" intro="Every school on SEA, their plan, and subscription status." />
        <EmptyState icon={Building2} title="No schools yet" description="Schools that sign up or are onboarded manually will appear here." />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Platform overview" title="Schools" intro="Every school on SEA, their plan, and subscription status." />
        <label className="flex h-[39px] min-w-[220px] items-center gap-2 rounded-md border border-border bg-bg-card px-3">
          <Search size={16} strokeWidth={1.8} className="text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools…"
            aria-label="Search schools"
            className="min-w-0 flex-1 border-0 bg-transparent text-caption text-text-primary outline-none"
          />
        </label>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border bg-bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex h-7 items-center rounded-sm px-3 text-caption font-medium ${
                tab === t.key ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-page"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-caption text-text-muted">
          Lifetime platform revenue: <strong className="font-medium text-text-secondary">{naira(totalRevenue)}</strong>
        </span>
      </div>

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["School", "Status", "Plan", "Students", "Lifetime revenue", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-body text-text-muted">
                    No schools match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfd]">
                    <td className="px-4 py-4 pl-5">
                      <strong className="block text-body font-medium text-text-primary">{s.name}</strong>
                      <span className="text-caption text-text-muted">{s.slug}</span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill label={STATUS_LABEL[s.status]} tone={STATUS_TONE[s.status]} />
                    </td>
                    <td className="px-4 py-4 text-body text-text-secondary">
                      {s.plan ? (
                        <>
                          {s.plan.billingCycle === "FULL_SESSION" ? "Full session" : "Per term"}
                          <div className="text-caption text-text-muted">Renews {new Date(s.plan.endDate).toLocaleDateString("en-GB")}</div>
                        </>
                      ) : (
                        <span className="text-text-muted">No active plan</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-body text-text-secondary">{s.studentCount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-body font-medium tabular-nums text-text-primary">{naira(s.revenue)}</td>
                    <td className="px-4 py-4 pr-5 text-right">
                      <Link
                        href={`/owner/schools/${s.id}`}
                        className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {filtered.length === 0 ? (
            <div className="rounded-md border border-border px-5 py-10 text-center text-body text-text-muted">
              No schools match your search.
            </div>
          ) : (
            filtered.map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block text-body font-medium text-text-primary">{s.name}</strong>
                    <span className="text-caption text-text-muted">{s.slug}</span>
                  </div>
                  <StatusPill label={STATUS_LABEL[s.status]} tone={STATUS_TONE[s.status]} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0f2f3] pt-3 text-caption">
                  <div>
                    <dt className="text-[10px] text-text-muted">Plan</dt>
                    <dd className="text-text-secondary">
                      {s.plan ? (
                        <>
                          {s.plan.billingCycle === "FULL_SESSION" ? "Full session" : "Per term"}
                          <div className="text-[10px] text-text-muted">Renews {new Date(s.plan.endDate).toLocaleDateString("en-GB")}</div>
                        </>
                      ) : (
                        <span className="text-text-muted">No active plan</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-text-muted">Students</dt>
                    <dd className="text-text-secondary">{s.studentCount.toLocaleString()}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[10px] text-text-muted">Lifetime revenue</dt>
                    <dd className="font-medium tabular-nums text-text-primary">{naira(s.revenue)}</dd>
                  </div>
                </dl>
                <Link
                  href={`/owner/schools/${s.id}`}
                  className="mt-3 flex h-9 w-full items-center justify-center rounded-md border border-[#cbdde9] bg-bg-card text-caption font-medium text-primary hover:bg-primary-bg"
                >
                  View
                </Link>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border px-5 py-4 text-caption text-text-muted">
          Showing {filtered.length} of {schools.length} schools
        </div>
      </section>
    </>
  );
}

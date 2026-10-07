import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_CATEGORIES,
  CATEGORY_LABEL,
  describeEmailChange,
  describePlatformEvent,
  describePricingChange,
  filterAndSort,
  isAuditCategory,
  paginate,
  parseComplimentaryNote,
  parseDay,
  type AuditCategory,
  type AuditEntry,
} from "@/lib/owner-audit";

const PAGE_SIZE = 50;
// Each source is read newest-first up to this many rows (inside the date range), then merged.
const PER_SOURCE = 300;

type SearchParams = { category?: string; from?: string; to?: string; page?: string };

const fieldClass = "h-9 rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary";
const fmt = (d: Date) => d.toLocaleString("en-GB");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const TONE: Record<AuditCategory, "success" | "warning" | "danger" | "neutral"> = {
  SCHOOLS: "neutral",
  ACCOUNTS: "warning",
  BILLING: "success",
  SETTINGS: "danger",
  REQUESTS: "warning",
  ANNOUNCEMENTS: "neutral",
};

export default async function OwnerAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // This page shows who did what across every school, so check the role here as well as in the proxy.
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const sp = await searchParams;
  const category = isAuditCategory(sp.category) ? sp.category : undefined;
  const from = parseDay(sp.from, false);
  const to = parseDay(sp.to, true);
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;

  const want = (c: AuditCategory) => !category || category === c;
  const range = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const take = PER_SOURCE;
  const newest = { createdAt: "desc" } as const;

  const [schoolsCreated, platformEvents, accountEvents, pricingChanges, complimentary, deletionRequests, announcements] = await Promise.all([
    want("SCHOOLS") ? prisma.school.findMany({ where: { createdAt: range }, orderBy: newest, take, select: { id: true, name: true, createdAt: true } }) : [],
    want("SCHOOLS") || want("ACCOUNTS") || want("SETTINGS") ? prisma.platformEvent.findMany({ where: { createdAt: range }, orderBy: newest, take }) : [],
    want("ACCOUNTS") ? prisma.accountEvent.findMany({ where: { action: "EMAIL_CHANGED", createdAt: range }, orderBy: newest, take }) : [],
    want("BILLING") ? prisma.pricingChange.findMany({ where: { changedAt: range }, orderBy: { changedAt: "desc" }, take }) : [],
    want("BILLING")
      ? prisma.subscription.findMany({ where: { isComplimentary: true, createdAt: range }, orderBy: newest, take, select: { id: true, schoolId: true, endDate: true, discountNote: true, createdAt: true } })
      : [],
    want("REQUESTS")
      ? prisma.deletionRequest.findMany({ where: from || to ? { OR: [{ requestedAt: range }, { resolvedAt: range }] } : {}, orderBy: { requestedAt: "desc" }, take })
      : [],
    want("ANNOUNCEMENTS") ? prisma.platformAnnouncement.findMany({ where: { createdAt: range }, orderBy: newest, take }) : [],
  ]);

  // Names for every id mentioned above.
  const userIds = new Set<string>();
  const addUser = (id: string | null | undefined) => {
    if (id) userIds.add(id);
  };
  platformEvents.forEach((e) => (addUser(e.actorUserId), addUser(e.targetUserId)));
  accountEvents.forEach((e) => (addUser(e.actorUserId), addUser(e.userId)));
  pricingChanges.forEach((c) => addUser(c.changedById));
  complimentary.forEach((c) => addUser(parseComplimentaryNote(c.discountNote).ownerId));
  deletionRequests.forEach((r) => (addUser(r.requestedByUserId), addUser(r.resolvedByUserId)));
  announcements.forEach((a) => addUser(a.createdByUserId));

  const [users, schools] = await Promise.all([
    userIds.size ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } }) : [],
    prisma.school.findMany({ select: { id: true, name: true } }),
  ]);
  const userName = (id: string | null | undefined) => (id ? (users.find((u) => u.id === id)?.name ?? "Deleted account") : null);
  const schoolName = new Map(schools.map((s) => [s.id, s.name]));

  const entries: AuditEntry[] = [];

  for (const s of schoolsCreated) {
    entries.push({ id: `school-${s.id}`, at: s.createdAt, category: "SCHOOLS", title: "School registered", detail: null, actor: null, schoolId: s.id });
  }
  for (const e of platformEvents) {
    const d = describePlatformEvent(e.action, e.metadata);
    const target = userName(e.targetUserId);
    entries.push({ id: `pe-${e.id}`, at: e.createdAt, category: d.category, title: d.title, detail: target ? `${target}. ${d.detail ?? ""}`.trim() : d.detail, actor: userName(e.actorUserId), schoolId: e.schoolId });
  }
  for (const e of accountEvents) {
    const actor = userName(e.actorUserId);
    entries.push({
      id: `ae-${e.id}`,
      at: e.createdAt,
      category: "ACCOUNTS",
      title: "Sign-in email changed",
      detail: describeEmailChange(userName(e.userId) ?? "Deleted account", e.metadata),
      actor: actor ? `${actor}${e.actorRole === "SCHOOL_ADMIN" ? " (school admin)" : ""}` : null,
      schoolId: e.schoolId,
    });
  }
  for (const c of pricingChanges) {
    entries.push({
      id: `pc-${c.id}`,
      at: c.changedAt,
      category: "BILLING",
      title: "Prices changed",
      detail: describePricingChange(c.before as Record<string, number>, c.after as Record<string, number>),
      actor: userName(c.changedById),
      schoolId: null,
    });
  }
  for (const s of complimentary) {
    const note = parseComplimentaryNote(s.discountNote);
    entries.push({
      id: `sub-${s.id}`,
      at: s.createdAt,
      category: "BILLING",
      title: "Free access granted",
      detail: `Until ${s.endDate.toLocaleDateString("en-GB")}. ${note.reason}`,
      actor: userName(note.ownerId),
      schoolId: s.schoolId,
    });
  }
  for (const r of deletionRequests) {
    entries.push({ id: `dr-${r.id}`, at: r.requestedAt, category: "REQUESTS", title: "Deletion requested", detail: clip(r.reason, 160), actor: userName(r.requestedByUserId), schoolId: r.schoolId });
    if (r.resolvedAt && r.status !== "PENDING") {
      entries.push({
        id: `dr-${r.id}-resolved`,
        at: r.resolvedAt,
        category: "REQUESTS",
        title: r.status === "APPROVED" ? "Deletion approved" : "Deletion declined",
        detail: r.resolutionNote ? clip(r.resolutionNote, 160) : null,
        actor: userName(r.resolvedByUserId),
        schoolId: r.schoolId,
      });
    }
  }
  for (const a of announcements) {
    entries.push({ id: `an-${a.id}`, at: a.createdAt, category: "ANNOUNCEMENTS", title: "Announcement posted", detail: clip(a.message, 160), actor: userName(a.createdByUserId), schoolId: null });
  }

  const timeline = filterAndSort(entries, { category, from, to });
  const view = paginate(timeline, page, PAGE_SIZE);

  const query = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ category: sp.category, from: sp.from, to: sp.to, ...extra })) if (v) params.set(k, v);
    return params.toString();
  };

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Audit log"
        intro="A timeline of what happened across the platform: schools switched on or off, account recovery, billing and settings changes, and requests. Entries are only ever added, never changed."
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-bg-card p-4">
        <label className="grid gap-1 text-[10px] text-text-muted">
          What
          <select name="category" defaultValue={category ?? ""} className={fieldClass}>
            <option value="">Everything</option>
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] text-text-muted">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-[10px] text-text-muted">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={fieldClass} />
        </label>
        <button type="submit" className="h-9 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white">
          Filter
        </button>
        <Link href="/owner/audit" className="h-9 self-end text-caption leading-9 text-text-muted hover:text-primary">
          Clear
        </Link>
      </form>

      {view.total === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing here yet" description="Platform activity appears here as it happens." />
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-4 text-caption text-text-muted">
            {view.total} {view.total === 1 ? "entry" : "entries"} · page {view.page} of {view.pages}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  {["When", "What", "Who", "School", "Details"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.items.map((e) => (
                  <tr key={e.id} className="border-b border-[#f0f2f3] align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 pl-5 text-caption text-text-secondary">{fmt(e.at)}</td>
                    <td className="px-4 py-3">
                      <div className="text-caption font-medium text-text-primary">{e.title}</div>
                      <div className="mt-1">
                        <StatusPill label={CATEGORY_LABEL[e.category]} tone={TONE[e.category]} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{e.actor ?? "—"}</td>
                    <td className="px-4 py-3 text-caption">
                      {e.schoolId ? (
                        <Link href={`/owner/schools/${e.schoolId}`} className="text-primary hover:underline">
                          {schoolName.get(e.schoolId) ?? "Unknown school"}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{e.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-caption">
              {view.page > 1 ? (
                <Link href={`/owner/audit?${query({ page: String(view.page - 1) })}`} className="text-primary hover:underline">
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              {view.page < view.pages && (
                <Link href={`/owner/audit?${query({ page: String(view.page + 1) })}`} className="text-primary hover:underline">
                  Older →
                </Link>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, AUDIT_PAGE_SIZE, countAudit, loadAudit, parseAuditFilters } from "@/lib/audit-query";
import { ACTION_LABEL } from "@/lib/audit-describe";

type SearchParams = { action?: string; classId?: string; from?: string; to?: string; actor?: string; page?: string };

const fieldClass = "h-9 rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await auth();
  const schoolId = session!.user.schoolId!;
  const filters = parseAuditFilters(sp);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [total, rows, classes, staff] = await Promise.all([
    countAudit(schoolId, filters),
    loadAudit(schoolId, filters, { skip: (page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE }),
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { schoolId, role: { in: ["SCHOOL_ADMIN", "TEACHER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  const query = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ action: sp.action, classId: sp.classId, from: sp.from, to: sp.to, actor: sp.actor, ...extra })) if (v) params.set(k, v);
    return params.toString();
  };

  return (
    <>
      <PageHeader
        eyebrow="School workspace"
        title="Audit log"
        intro="Every submission, send-back, approval, publication and correction — who did it, when, why, and under which template version. Entries can be added to, never changed."
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-bg-card p-4">
        <label className="grid gap-1 text-[10px] text-text-muted">
          Action
          <select name="action" defaultValue={sp.action ?? ""} className={fieldClass}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] text-text-muted">
          Class
          <select name="classId" defaultValue={sp.classId ?? ""} className={fieldClass}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] text-text-muted">
          Done by
          <select name="actor" defaultValue={sp.actor ?? ""} className={fieldClass}>
            <option value="">Anyone</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
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
        <Link href="/admin/audit" className="h-9 self-end text-caption leading-9 text-text-muted hover:text-primary">
          Clear
        </Link>
        <a
          href={`/admin/audit/export?${query({})}`}
          className="ml-auto inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary hover:bg-bg-page"
        >
          Export CSV
        </a>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No matching entries" description="Actions on results appear here as they happen." />
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <span className="text-caption text-text-muted">
              {total} {total === 1 ? "entry" : "entries"} · page {page} of {pages}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  {["When", "Action", "Class · term", "Student", "Done by", "Reason", "Details"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#f0f2f3] align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 pl-5 text-caption text-text-secondary">{r.at.toLocaleString("en-GB")}</td>
                    <td className="px-4 py-3 text-caption font-medium text-text-primary">{r.actionLabel}</td>
                    <td className="px-4 py-3 text-caption text-text-secondary">
                      {r.className}
                      <span className="block text-[10px] text-text-muted">
                        {r.term}
                        {r.templateVersion ? ` · ${r.templateVersion}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{r.student || "Whole class"}</td>
                    <td className="px-4 py-3 text-caption text-text-secondary">
                      {r.actor}
                      {r.actorRole && <span className="block text-[10px] capitalize text-text-muted">{r.actorRole}</span>}
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{r.reason || "—"}</td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{r.summary || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-caption">
              {page > 1 ? (
                <Link href={`/admin/audit?${query({ page: String(page - 1) })}`} className="text-primary hover:underline">
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              {page < pages && (
                <Link href={`/admin/audit?${query({ page: String(page + 1) })}`} className="text-primary hover:underline">
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

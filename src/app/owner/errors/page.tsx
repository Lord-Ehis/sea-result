import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROUTE_TYPE_LABEL } from "@/lib/error-rules";
import { ResolveAllButton, ResolveButton } from "./ResolveButtons";

const SHOW_DAYS = 14;
const fmt = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const thClass = "border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5";

export default async function OwnerErrorsPage() {
  // Error messages can contain details from the request, so check the role here as well as in the proxy.
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const since = new Date(new Date().getTime() - SHOW_DAYS * 86_400_000);
  const errors = await prisma.errorEvent.findMany({ where: { lastSeenAt: { gte: since } }, orderBy: { lastSeenAt: "desc" }, take: 100 });
  const open = errors.filter((e) => !e.resolvedAt);

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Site errors"
        intro={`Things that went wrong on the server in the last ${SHOW_DAYS} days: a page that failed to load, a button that crashed. The same error is listed once with a count, and you are emailed the first time and then at most once an hour. Check that the site is up at /api/health.`}
      />

      {open.length === 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-success/30 bg-success-bg px-5 py-4 text-body text-success">
          <CheckCircle2 size={20} strokeWidth={1.8} />
          No open errors. Nothing has gone wrong on the server that you haven&apos;t marked fixed.
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-body text-text-secondary">
            <strong className="font-medium text-danger">{open.length} open</strong>
            {errors.length > open.length ? ` · ${errors.length - open.length} marked fixed` : ""}
          </p>
          <ResolveAllButton count={open.length} />
        </div>
      )}

      {errors.length > 0 && (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  {["Last seen", "Where", "What went wrong", "Times", "Status", ""].map((h, i) => (
                    <th key={i} className={thClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.id} className="border-b border-[#f0f2f3] align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 pl-5 text-caption text-text-secondary">
                      {fmt(e.lastSeenAt)}
                      <div className="text-[10px] text-text-muted">first {fmt(e.firstSeenAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">
                      <code className="break-all font-mono text-[11px] text-text-primary">{e.route}</code>
                      <div className="text-[10px] text-text-muted">{ROUTE_TYPE_LABEL[e.routeType] ?? e.routeType}</div>
                    </td>
                    <td className="max-w-[360px] px-4 py-3 text-caption text-text-secondary">
                      <div className="break-words text-text-primary">
                        {e.name}: {e.message}
                      </div>
                      {e.stack && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-primary">Technical details</summary>
                          <pre className="m-0 mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-text-muted">{e.stack}</pre>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-3 text-caption tabular-nums text-text-secondary">{e.count.toLocaleString()}</td>
                    <td className="px-4 py-3">{e.resolvedAt ? <StatusPill label="Fixed" tone="success" /> : <StatusPill label="Open" tone="danger" />}</td>
                    <td className="px-4 py-3 pr-5 text-right">{!e.resolvedAt && <ResolveButton id={e.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

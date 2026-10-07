import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPricing } from "@/lib/pricing-settings";
import { relativeDays } from "@/lib/owner-attention";
import {
  PLAN_LABEL,
  latestPaymentBySchool,
  renewalsDue,
  revenueByMonth,
  revenueByPeriod,
  revenueBySchool,
  type PaidPayment,
  type RenewalRow,
} from "@/lib/owner-revenue";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const thClass = "border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5";
const fieldClass = "h-9 rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary";

export default async function OwnerRevenuePage() {
  // Every school's payments: check the role here as well as in the proxy.
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const now = new Date();
  const [paid, schools, pricing] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "SUCCESS", paidAt: { not: null } },
      select: { amount: true, paidAt: true, schoolId: true, billingCycle: true, session: true, termNumber: true, isRegistration: true },
    }),
    prisma.school.findMany({
      select: { id: true, name: true, status: true, subscriptions: { select: { status: true, startDate: true, endDate: true, billingCycle: true, isComplimentary: true } } },
    }),
    getPricing(),
  ]);

  const payments: PaidPayment[] = paid.flatMap((p) => (p.paidAt ? [{ ...p, amount: p.amount.toNumber(), paidAt: p.paidAt }] : []));
  const names = new Map(schools.map((s) => [s.id, s.name]));

  const months = revenueByMonth(payments, now, 12);
  const thisMonth = months[months.length - 1];
  const last12 = months.reduce((sum, m) => sum + m.total, 0);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const periods = revenueByPeriod(payments);
  const bySchool = revenueBySchool(payments, names, now);
  const lastPaid = latestPaymentBySchool(payments);
  const renewals = renewalsDue(schools, now);

  const expected = (rows: RenewalRow[]) => rows.length * pricing.termPrice;
  const groups: { label: string; rows: RenewalRow[] }[] = [
    { label: "Already ended", rows: renewals.ended },
    { label: "Next 30 days", rows: renewals.next30 },
    { label: "31 to 60 days", rows: renewals.next60 },
    { label: "61 to 90 days", rows: renewals.next90 },
  ];
  const renewalCount = groups.reduce((sum, g) => sum + g.rows.length, 0);

  const tiles = [
    { label: "Collected this month", value: naira(thisMonth.total), note: `${thisMonth.count} ${thisMonth.count === 1 ? "payment" : "payments"}` },
    { label: "Collected, last 12 months", value: naira(last12), note: `${months.reduce((s, m) => s + m.count, 0)} payments` },
    { label: "Renewals due, next 30 days", value: String(renewals.next30.length), note: renewals.next30.length > 0 ? `about ${naira(expected(renewals.next30))}` : "none due" },
    { label: "Coverage already ended", value: String(renewals.ended.length), note: renewals.ended.length > 0 ? `about ${naira(expected(renewals.ended))} to win back` : "none" },
  ];

  return (
    <>
      <PageHeader eyebrow="Platform overview" title="Revenue & renewals" intro="What has been collected, who is due to renew, and a download for your accountant. Only successful payments are counted." />

      <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Summary">
        {tiles.map((t) => (
          <div key={t.label} className="flex min-h-[110px] flex-col justify-between rounded-md border border-border bg-bg-card p-4">
            <span className="text-caption leading-snug text-text-secondary">{t.label}</span>
            <div>
              <div className="text-title font-medium tracking-tight text-text-primary">{t.value}</div>
              <div className="mt-1 text-[10px] text-text-muted">{t.note}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="mb-6 overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="m-0 text-heading font-medium text-text-primary">Renewals coming up</h2>
          <p className="mt-1 text-caption text-text-muted">Schools whose coverage ends within 90 days, or already has. A school that has paid for the next term is not listed.</p>
        </div>
        {renewalCount === 0 ? (
          <p className="m-0 px-5 py-5 text-caption text-text-muted">Nobody is due to renew in the next 90 days.</p>
        ) : (
          groups.map(({ label, rows }) =>
            rows.length === 0 ? null : (
              <div key={label}>
                <div className="flex items-center justify-between bg-[#fafbfb] px-5 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  <span>
                    {label} · {rows.length} {rows.length === 1 ? "school" : "schools"}
                  </span>
                  <span>about {naira(expected(rows))}</span>
                </div>
                {rows.map((r) => {
                  const last = lastPaid.get(r.schoolId);
                  return (
                    <div key={r.schoolId} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f2f3] px-5 py-3.5 last:border-0">
                      <div className="min-w-0">
                        <Link href={`/owner/schools/${r.schoolId}`} className="text-body font-medium text-primary hover:underline">
                          {r.name}
                        </Link>
                        <div className="text-caption text-text-muted">
                          {r.daysLeft >= 0 ? "Ends" : "Ended"} {fmtDate(r.coverageEndsAt)} ({relativeDays(r.daysLeft)}) · {PLAN_LABEL[r.plan]}
                          {last ? ` · last paid ${naira(last.amount)} on ${fmtDate(last.paidAt)}` : " · has never paid"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.state === "LAPSED" && <StatusPill label="Locked out" tone="danger" />}
                        {r.state === "GRACE" && <StatusPill label="In grace period" tone="warning" />}
                        {r.plan === "FREE" && <StatusPill label="Free access" tone="neutral" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ),
          )
        )}
        <p className="m-0 border-t border-border bg-[#fafbfb] px-5 py-3 text-caption text-text-muted">
          &ldquo;About&rdquo; is one term at today&apos;s price ({naira(pricing.termPrice)}) for each school. Schools that usually buy a full session will pay more.
          {renewals.neverSubscribed > 0 ? ` ${renewals.neverSubscribed} ${renewals.neverSubscribed === 1 ? "school has" : "schools have"} never subscribed and ${renewals.neverSubscribed === 1 ? "is" : "are"} not counted here.` : ""}
        </p>
      </section>

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet" description="Revenue will appear here once schools start paying." />
      ) : (
        <>
          <section className="mb-6 overflow-hidden rounded-md border border-border bg-bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="m-0 text-heading font-medium text-text-primary">Revenue by month</h2>
              <p className="mt-1 text-caption text-text-muted">The last 12 months, by the date each payment was made.</p>
            </div>
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  <th className={thClass}>Month</th>
                  <th className={thClass}>Collected</th>
                  <th className={thClass}>Payments</th>
                  <th className={`${thClass} w-[40%]`}> </th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => (
                  <tr key={m.key} className="border-b border-[#f0f2f3] last:border-0">
                    <td className="px-4 py-2.5 pl-5 text-body text-text-secondary">{m.label}</td>
                    <td className="px-4 py-2.5 text-body font-medium tabular-nums text-text-primary">{naira(m.total)}</td>
                    <td className="px-4 py-2.5 text-body tabular-nums text-text-secondary">{m.count}</td>
                    <td className="px-4 py-2.5 pr-5">
                      <div className="h-2 rounded-full bg-bg-page" aria-hidden>
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((m.total / maxMonth) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-md border border-border bg-bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="m-0 text-heading font-medium text-text-primary">Revenue by term</h2>
                <p className="mt-1 text-caption text-text-muted">What each payment was for, all time.</p>
              </div>
              <table className="w-full border-collapse text-left">
                <thead className="bg-[#fafbfb]">
                  <tr>
                    <th className={thClass}>Covers</th>
                    <th className={thClass}>Collected</th>
                    <th className={thClass}>Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.label} className="border-b border-[#f0f2f3] last:border-0">
                      <td className="px-4 py-2.5 pl-5 text-body text-text-secondary">{p.label}</td>
                      <td className="px-4 py-2.5 text-body font-medium tabular-nums text-text-primary">{naira(p.total)}</td>
                      <td className="px-4 py-2.5 text-body tabular-nums text-text-secondary">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="overflow-hidden rounded-md border border-border bg-bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="m-0 text-heading font-medium text-text-primary">Revenue by school</h2>
                <p className="mt-1 text-caption text-text-muted">Biggest contributors over the last 12 months first.</p>
              </div>
              <table className="w-full border-collapse text-left">
                <thead className="bg-[#fafbfb]">
                  <tr>
                    <th className={thClass}>School</th>
                    <th className={thClass}>Last 12 months</th>
                    <th className={thClass}>Share</th>
                    <th className={thClass}>All time</th>
                  </tr>
                </thead>
                <tbody>
                  {bySchool.map((s) => (
                    <tr key={s.schoolId} className="border-b border-[#f0f2f3] last:border-0">
                      <td className="px-4 py-2.5 pl-5 text-body">
                        <Link href={`/owner/schools/${s.schoolId}`} className="font-medium text-primary hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-body font-medium tabular-nums text-text-primary">{naira(s.last12)}</td>
                      <td className="px-4 py-2.5 text-body tabular-nums text-text-secondary">{s.sharePct}%</td>
                      <td className="px-4 py-2.5 text-body tabular-nums text-text-secondary">{naira(s.lifetime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}

      <section className="rounded-md border border-border bg-bg-card p-5">
        <h2 className="m-0 text-heading font-medium text-text-primary">Download for your accountant</h2>
        <p className="mt-1 mb-4 text-caption text-text-muted">A spreadsheet (CSV) of paid payments: date, school, reference, amount, plan, session and term. Leave the dates empty for everything.</p>
        <form action="/owner/revenue/export" method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-[10px] text-text-muted">
            From
            <input type="date" name="from" className={fieldClass} />
          </label>
          <label className="grid gap-1 text-[10px] text-text-muted">
            To
            <input type="date" name="to" className={fieldClass} />
          </label>
          <button type="submit" className="h-9 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white">
            Download CSV
          </button>
        </form>
      </section>
    </>
  );
}

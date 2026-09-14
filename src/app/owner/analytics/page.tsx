import Link from "next/link";
import { BarChart3, CreditCard, TrendingUp, Building2, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { prisma } from "@/lib/prisma";

const naira = (n: number) => `₦${n.toLocaleString()}`;

const PAYMENT_STATUS_TONE = { SUCCESS: "success", PENDING: "warning", FAILED: "danger" } as const;
const PAYMENT_STATUS_LABEL = { SUCCESS: "Paid", PENDING: "Pending", FAILED: "Failed" } as const;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export default async function AnalyticsPage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const sixMonthsAgo = new Date(startOfMonth);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

  const [totalRevenueAgg, monthRevenueAgg, activeSubscriptions, totalSchools, activeSchools, totalStudents, recentPayments, recentSuccessPayments] =
    await Promise.all([
      prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: "SUCCESS", paidAt: { gte: startOfMonth } }, _sum: { amount: true } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.school.count(),
      prisma.school.count({ where: { status: "ACTIVE" } }),
      prisma.student.count({ where: { isActive: true } }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { school: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        where: { status: "SUCCESS", paidAt: { gte: sixMonthsAgo } },
        select: { amount: true, paidAt: true },
      }),
    ]);

  const totalRevenue = totalRevenueAgg._sum.amount?.toNumber() ?? 0;

  if (totalSchools === 0) {
    return (
      <>
        <PageHeader eyebrow="Platform overview" title="Analytics & reports" intro="Adoption and revenue across all schools." />
        <EmptyState icon={BarChart3} title="No data yet" description="Analytics will populate once schools start subscribing." />
      </>
    );
  }

  const monthBuckets: { key: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(startOfMonth);
    d.setMonth(d.getMonth() - i);
    monthBuckets.push({ key: monthKey(d), total: 0 });
  }
  const bucketMap = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const p of recentSuccessPayments) {
    if (!p.paidAt) continue;
    const bucket = bucketMap.get(monthKey(p.paidAt));
    if (bucket) bucket.total += p.amount.toNumber();
  }
  const maxBucket = Math.max(1, ...monthBuckets.map((b) => b.total));

  const metrics = [
    { label: "Lifetime revenue", value: naira(totalRevenue), icon: CreditCard },
    { label: "Revenue this month", value: naira(monthRevenueAgg._sum.amount?.toNumber() ?? 0), icon: TrendingUp },
    { label: "Active subscriptions", value: activeSubscriptions.toLocaleString(), icon: BarChart3 },
    { label: "Schools", value: `${activeSchools.toLocaleString()} / ${totalSchools.toLocaleString()}`, icon: Building2 },
  ];

  return (
    <>
      <PageHeader eyebrow="Platform overview" title="Analytics & reports" intro="Adoption and revenue across all schools." />

      <section className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Platform metrics">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-h-[120px] flex-col justify-between rounded-md border border-border bg-bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-caption leading-snug text-text-secondary">{label}</span>
              <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg bg-primary-bg text-primary">
                <Icon size={17} strokeWidth={1.8} />
              </span>
            </div>
            <div className="text-title font-medium tracking-tight text-text-primary">{value}</div>
          </div>
        ))}
      </section>

      <div className="mb-7 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-md border border-border bg-bg-card p-5">
          <h2 className="m-0 mb-1 text-heading font-medium text-text-primary">Revenue, last 6 months</h2>
          <p className="m-0 mb-5 text-caption text-text-muted">Successful payments by month</p>
          <div className="grid gap-3">
            {monthBuckets.map((b) => (
              <div key={b.key} className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
                <span className="text-caption text-text-muted">{monthLabel(b.key)}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-bg-page">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (b.total / maxBucket) * 100)}%` }} />
                </div>
                <span className="text-caption font-medium tabular-nums text-text-secondary">{naira(b.total)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-border bg-bg-card p-5">
          <h2 className="m-0 mb-1 text-heading font-medium text-text-primary">Adoption</h2>
          <p className="m-0 mb-5 text-caption text-text-muted">Snapshot across the platform</p>
          <div className="grid gap-4">
            <div className="flex items-center justify-between border-b border-[#f0f2f3] pb-4">
              <span className="flex items-center gap-2 text-caption text-text-secondary">
                <Building2 size={15} strokeWidth={1.8} className="text-text-muted" />
                Total schools
              </span>
              <strong className="text-body font-medium text-text-primary">{totalSchools.toLocaleString()}</strong>
            </div>
            <div className="flex items-center justify-between border-b border-[#f0f2f3] pb-4">
              <span className="flex items-center gap-2 text-caption text-text-secondary">
                <BarChart3 size={15} strokeWidth={1.8} className="text-text-muted" />
                Active subscriptions
              </span>
              <strong className="text-body font-medium text-text-primary">{activeSubscriptions.toLocaleString()}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-caption text-text-secondary">
                <Users size={15} strokeWidth={1.8} className="text-text-muted" />
                Total students
              </span>
              <strong className="text-body font-medium text-text-primary">{totalStudents.toLocaleString()}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-5">
          <h2 className="m-0 text-heading font-medium text-text-primary">Recent payments</h2>
          <p className="mt-1.5 text-caption text-text-muted">Across every school on the platform</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Date", "School", "Reference", "Amount", "Status"].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-body text-text-muted">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                recentPayments.map((p) => (
                  <tr key={p.id} className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfd]">
                    <td className="px-4 py-4 pl-5 text-body text-text-secondary">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-4">
                      <Link href={`/owner/schools/${p.schoolId}`} className="text-body font-medium text-primary hover:underline">
                        {p.school.name}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-body text-text-secondary">{p.paystackReference}</td>
                    <td className="px-4 py-4 text-body font-medium tabular-nums text-text-primary">{naira(p.amount.toNumber())}</td>
                    <td className="px-4 py-4">
                      <StatusPill label={PAYMENT_STATUS_LABEL[p.status]} tone={PAYMENT_STATUS_TONE[p.status]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

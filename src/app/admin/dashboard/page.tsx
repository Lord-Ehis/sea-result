import Link from "next/link";
import { Users, FileText, Building2, Check, CreditCard, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const [totalStudents, activeCampuses, subscription, submitted] = await Promise.all([
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.campus.count({ where: { schoolId, isActive: true } }),
    prisma.subscription.findFirst({ where: { schoolId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    prisma.result.findMany({
      where: { schoolId, status: "SUBMITTED" },
      include: { template: { include: { class: true } }, submittedBy: true },
      orderBy: { submittedAt: "asc" },
    }),
  ]);

  const batches = new Map<string, { templateId: string; className: string; teacherName: string; submittedAt: Date | null; count: number }>();
  for (const r of submitted) {
    const key = r.templateId;
    if (!batches.has(key)) {
      batches.set(key, {
        templateId: key,
        className: r.template.class?.name ?? "All classes",
        teacherName: r.submittedBy?.name ?? "—",
        submittedAt: r.submittedAt,
        count: 0,
      });
    }
    batches.get(key)!.count++;
  }
  const queue = Array.from(batches.values());

  const metrics = [
    { label: "Total students", value: totalStudents.toLocaleString(), icon: Users },
    { label: "Pending result approvals", value: queue.length.toString(), icon: FileText, tone: "amber" as const },
    { label: "Active campuses", value: activeCampuses.toLocaleString(), icon: Building2 },
    {
      label: "Subscription status",
      value: subscription ? "Active" : "None",
      icon: Check,
      tone: subscription ? ("green" as const) : undefined,
    },
  ];

  const tiles = [
    { href: "/admin/students", icon: Users, title: "Manage students", desc: "View enrolment and student records" },
    { href: "/admin/result-templates", icon: FileText, title: "Result templates", desc: "Set up report formats for each class" },
    { href: "/admin/billing", icon: CreditCard, title: "Billing", desc: "View your plan and payment history" },
  ];

  return (
    <>
      <PageHeader eyebrow="School overview" title="Dashboard" intro="Welcome back. Here's what needs your attention across your campuses." />

      <section className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="School metrics">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex min-h-[136px] flex-col justify-between rounded-md border border-border bg-bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-caption leading-snug text-text-secondary">{label}</span>
              <span
                className={`grid h-[34px] w-[34px] place-items-center rounded-lg ${
                  tone === "amber" ? "bg-warning-bg text-warning" : tone === "green" ? "bg-success-bg text-success" : "bg-primary-bg text-primary"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} />
              </span>
            </div>
            <div className={`font-medium tracking-tight ${tone === "green" ? "text-title text-success" : "text-title text-text-primary"}`}>
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Results awaiting approval</h2>
            <p className="mt-1.5 text-caption text-text-muted">Review submitted results before they&apos;re published.</p>
          </div>
          {queue.length > 0 && (
            <span className="rounded-full bg-warning-bg px-2.5 py-1.5 text-caption text-warning">{queue.length} pending</span>
          )}
        </div>
        {queue.length === 0 ? (
          <p className="px-5 py-10 text-center text-body text-text-muted">All submitted results have been reviewed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  {["Class", "Teacher", "Date submitted", ""].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((b) => (
                  <tr key={b.templateId} className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfd]">
                    <td className="px-4 py-4 pl-5 text-body font-medium text-text-primary">{b.className}</td>
                    <td className="px-4 py-4 text-body text-text-secondary">{b.teacherName}</td>
                    <td className="px-4 py-4 text-body text-text-secondary">
                      {b.submittedAt ? new Date(b.submittedAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-4 pr-5 text-right">
                      <Link
                        href={`/admin/results/${b.templateId}`}
                        className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="m-0 text-heading font-medium text-text-primary">Quick access</h2>
        <span className="text-caption text-text-muted">Go straight to what you need</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex min-h-[95px] items-start gap-3.5 rounded-md border border-border bg-bg-card p-5 hover:border-primary/40 hover:bg-bg-page/40"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-primary-bg text-primary">
              <t.icon size={18} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-body font-medium text-text-primary">{t.title}</strong>
              <small className="mt-1.5 block text-caption text-text-muted">{t.desc}</small>
            </span>
            <ArrowRight size={16} strokeWidth={1.8} className="mt-1 flex-none text-text-muted" />
          </Link>
        ))}
      </div>
    </>
  );
}

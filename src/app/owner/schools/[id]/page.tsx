import Link from "next/link";
import { ArrowLeft, Building2, Mail, CalendarDays, CreditCard, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { prisma } from "@/lib/prisma";
import { resolveSchoolAccess } from "@/lib/school-access";
import { SchoolStatusToggle } from "./SchoolStatusToggle";
import { ComplimentaryAccessPanel } from "./ComplimentaryAccessPanel";
import { DeletionRequestPanel } from "./DeletionRequestPanel";

const naira = (n: number) => `₦${n.toLocaleString()}`;

const SCHOOL_STATUS_TONE = { ACTIVE: "success", SUSPENDED: "danger", PENDING_DELETION: "warning" } as const;
const SCHOOL_STATUS_LABEL = { ACTIVE: "Active", SUSPENDED: "Suspended", PENDING_DELETION: "Pending deletion" } as const;
const PAYMENT_STATUS_TONE = { SUCCESS: "success", PENDING: "warning", FAILED: "danger" } as const;
const PAYMENT_STATUS_LABEL = { SUCCESS: "Paid", PENDING: "Pending", FAILED: "Failed" } as const;

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      campuses: { orderBy: { name: "asc" } },
      users: { where: { role: "SCHOOL_ADMIN" }, orderBy: { createdAt: "asc" } },
      subscriptions: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      deletionRequests: { orderBy: { requestedAt: "desc" }, take: 1, include: { requestedBy: true, resolvedBy: true } },
      _count: { select: { students: true } },
    },
  });

  if (!school) {
    return (
      <>
        <PageHeader eyebrow="School detail" title="School not found" />
        <EmptyState icon={Building2} title="School not found" description="This school may have been removed." />
      </>
    );
  }

  const activeSubscription = school.subscriptions.find((s) => s.status === "ACTIVE") ?? null;
  // What the school can actually do right now, from its status and subscriptions.
  const access = resolveSchoolAccess({ status: school.status, subscriptions: school.subscriptions, now: new Date() });
  const accessNote =
    access.state === "GRACE"
      ? "Subscription ended — in grace period"
      : access.state === "LAPSED"
        ? access.coverageEndsAt
          ? "Subscription ended — staff locked"
          : "No subscription — staff locked"
        : null;
  const lifetimeRevenue = school.payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + p.amount.toNumber(), 0);

  return (
    <>
      <Link href="/owner/schools" className="mb-4 inline-flex items-center gap-1.5 text-caption font-medium text-text-secondary hover:text-primary">
        <ArrowLeft size={15} strokeWidth={1.8} />
        Back to schools
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-primary">School detail</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-title font-medium tracking-tight text-text-primary">{school.name}</h1>
            <StatusPill label={SCHOOL_STATUS_LABEL[school.status]} tone={SCHOOL_STATUS_TONE[school.status]} />
            {accessNote && <StatusPill label={accessNote} tone={access.state === "GRACE" ? "warning" : "danger"} />}
          </div>
          <p className="mt-2 text-body text-text-muted">
            {school.slug} · Joined {new Date(school.createdAt).toLocaleDateString("en-GB")}
          </p>
        </div>
        <SchoolStatusToggle schoolId={school.id} status={school.status} />
      </div>

      {school.deletionRequests[0] && (
        <DeletionRequestPanel
          request={{
            id: school.deletionRequests[0].id,
            status: school.deletionRequests[0].status,
            reason: school.deletionRequests[0].reason,
            requestedAt: school.deletionRequests[0].requestedAt.toISOString(),
            requestedByName: school.deletionRequests[0].requestedBy.name,
            requestedByEmail: school.deletionRequests[0].requestedBy.email,
            resolvedAt: school.deletionRequests[0].resolvedAt?.toISOString() ?? null,
            resolutionNote: school.deletionRequests[0].resolutionNote,
            resolvedByName: school.deletionRequests[0].resolvedBy?.name ?? null,
          }}
        />
      )}

      <ComplimentaryAccessPanel schoolId={school.id} />

      <section className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="School metrics">
        {[
          { label: "Lifetime revenue", value: naira(lifetimeRevenue), icon: CreditCard },
          {
            label: "Active plan",
            value: activeSubscription ? (activeSubscription.billingCycle === "FULL_SESSION" ? "Full session" : "Per term") : "None",
            icon: CalendarDays,
          },
          { label: "Students", value: school._count.students.toLocaleString(), icon: Users },
          { label: "Campuses", value: school.campuses.length.toLocaleString(), icon: Building2 },
        ].map(({ label, value, icon: Icon }) => (
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

      <div className="mb-7 grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">Current subscription</h2>
          </div>
          <div className="p-5">
            {activeSubscription ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="mb-1.5 block text-[10px] text-text-muted">Billing cycle</span>
                  <strong className="text-caption font-medium text-text-secondary">
                    {activeSubscription.billingCycle === "FULL_SESSION" ? "Full session" : `Per term — ${activeSubscription.term ?? "—"}`}
                  </strong>
                </div>
                <div>
                  <span className="mb-1.5 block text-[10px] text-text-muted">Session</span>
                  <strong className="text-caption font-medium text-text-secondary">{activeSubscription.session}</strong>
                </div>
                <div>
                  <span className="mb-1.5 block text-[10px] text-text-muted">Amount</span>
                  <strong className="text-caption font-medium text-text-secondary">{naira(activeSubscription.amount.toNumber())}</strong>
                </div>
                <div>
                  <span className="mb-1.5 block text-[10px] text-text-muted">{access.state === "SUSPENDED" ? "Coverage ends" : "Access ends"}</span>
                  <strong className="text-caption font-medium text-text-secondary">
                    {(access.coverageEndsAt ?? activeSubscription.endDate).toLocaleDateString("en-GB", { timeZone: "UTC" })}
                    {activeSubscription.isComplimentary ? " · complimentary" : ""}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="m-0 text-body text-text-muted">This school has no active subscription.</p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">School admins</h2>
          </div>
          <div className="divide-y divide-[#f0f2f3]">
            {school.users.length === 0 ? (
              <p className="px-5 py-6 text-body text-text-muted">No admin account yet.</p>
            ) : (
              school.users.map((u) => (
                <div key={u.id} className="flex items-center gap-2.5 px-5 py-4">
                  <span className="grid h-[33px] w-[33px] flex-none place-items-center rounded-md bg-primary-bg text-[10px] font-medium text-primary">
                    {u.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-body font-medium text-text-primary">{u.name}</strong>
                    <span className="flex items-center gap-1 text-caption text-text-muted">
                      <Mail size={12} strokeWidth={1.8} />
                      {u.email}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mb-7 overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Payment history</h2>
            <p className="mt-1.5 text-caption text-text-muted">All payments made by this school</p>
          </div>
          <span className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption text-text-secondary">
            {school.payments.length} {school.payments.length === 1 ? "payment" : "payments"}
          </span>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Date", "Reference", "Amount", "Status"].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {school.payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-body text-text-muted">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                school.payments.map((p) => (
                  <tr key={p.id} className="border-b border-[#f0f2f3] last:border-0">
                    <td className="px-4 py-4 pl-5 text-body text-text-secondary">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
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

        <div className="grid gap-3 p-4 lg:hidden">
          {school.payments.length === 0 ? (
            <div className="rounded-md border border-border px-5 py-10 text-center text-body text-text-muted">No payments yet.</div>
          ) : (
            school.payments.map((p) => (
              <div key={p.id} className="rounded-md border border-border bg-bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption text-text-secondary">{new Date(p.createdAt).toLocaleDateString("en-GB")}</span>
                  <StatusPill label={PAYMENT_STATUS_LABEL[p.status]} tone={PAYMENT_STATUS_TONE[p.status]} />
                </div>
                <dl className="mt-3 grid gap-2 border-t border-[#f0f2f3] pt-3 text-caption">
                  <div>
                    <dt className="text-[10px] text-text-muted">Reference</dt>
                    <dd className="text-text-secondary">{p.paystackReference}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-text-muted">Amount</dt>
                    <dd className="font-medium tabular-nums text-text-primary">{naira(p.amount.toNumber())}</dd>
                  </div>
                </dl>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-5">
          <h2 className="m-0 text-heading font-medium text-text-primary">Campuses</h2>
        </div>
        {school.campuses.length === 0 ? (
          <p className="px-5 py-6 text-body text-text-muted">No campuses added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 p-5">
            {school.campuses.map((c) => (
              <span key={c.id} className="rounded-md border border-border bg-bg-page px-3 py-1.5 text-caption text-text-secondary">
                {c.name}
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

import { Bell, Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { getAdminAccess } from "@/lib/admin-access";
import { ofStudentWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { RetryButton } from "./RetryButton";

const EVENT_LABEL: Record<string, string> = {
  RESULT_PUBLISHED: "Result published",
  RESULT_AMENDED: "Result corrected",
  SUBSCRIPTION_REMINDER: "Subscription reminder",
  PAYMENT_RECEIVED: "Payment received",
  ACCOUNT_CREATED: "Account created",
  PASSWORD_RESET: "Password reset",
};

export default async function NotificationsPage() {
  const access = await getAdminAccess();
  const { schoolId } = access;

  // A campus admin sees only messages about their own campuses' students; the
  // school's account emails (no student) stay with the main admin.
  const notifications = await prisma.notification.findMany({
    where: { schoolId, ...ofStudentWhere(access) },
    include: { student: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const retryable = notifications.filter((n) => n.status === "FAILED" && (n.event === "RESULT_PUBLISHED" || n.event === "RESULT_AMENDED"));

  if (notifications.length === 0) {
    return (
      <>
        <PageHeader eyebrow="School workspace" title="Notifications" intro="SMS and email alerts sent to parents." />
        <EmptyState icon={Bell} title="No notifications yet" description="Notifications sent when results publish will be logged here." />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="School workspace" title="Notifications" intro="SMS and email alerts sent to parents." />
      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Notification log</h2>
            <p className="mt-1.5 text-caption text-text-muted">Most recent 100 notifications</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {retryable.length > 0 && <RetryButton label={`Retry ${retryable.length} failed`} />}
            <span className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption text-text-secondary">
              {notifications.length} {notifications.length === 1 ? "notification" : "notifications"}
            </span>
          </div>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Date", "Student", "Channel", "Event", "Recipient", "Status", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className="border-b border-[#f0f2f3] last:border-0">
                  <td className="px-4 py-4 pl-5 text-body text-text-secondary">{new Date(n.createdAt).toLocaleString("en-GB")}</td>
                  <td className="px-4 py-4 text-body text-text-primary">
                    {n.student ? `${n.student.firstName} ${n.student.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
                      {n.channel === "SMS" ? <MessageSquare size={14} strokeWidth={1.8} /> : <Mail size={14} strokeWidth={1.8} />}
                      {n.channel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-body text-text-secondary">{EVENT_LABEL[n.event] ?? n.event}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{n.recipient}</td>
                  <td className="px-4 py-4">
                    <StatusPill
                      label={n.status === "SENT" ? "Sent" : n.status === "PENDING" ? "Pending" : "Failed"}
                      tone={n.status === "SENT" ? "success" : n.status === "PENDING" ? "warning" : "danger"}
                    />
                  </td>
                  <td className="px-4 py-4 pr-5 text-right">
                    {n.status === "FAILED" && (n.event === "RESULT_PUBLISHED" || n.event === "RESULT_AMENDED") && <RetryButton ids={[n.id]} label="Retry" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {notifications.map((n) => (
            <div key={n.id} className="rounded-md border border-border bg-bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-body font-medium text-text-primary">
                  {n.student ? `${n.student.firstName} ${n.student.lastName}` : "—"}
                </strong>
                <StatusPill
                  label={n.status === "SENT" ? "Sent" : n.status === "PENDING" ? "Pending" : "Failed"}
                  tone={n.status === "SENT" ? "success" : n.status === "PENDING" ? "warning" : "danger"}
                />
              </div>
              <dl className="mt-3 grid gap-2 border-t border-[#f0f2f3] pt-3 text-caption">
                <div>
                  <dt className="text-[10px] text-text-muted">Date</dt>
                  <dd className="text-text-secondary">{new Date(n.createdAt).toLocaleString("en-GB")}</dd>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-[10px] text-text-muted">Channel</dt>
                    <dd className="mt-0.5 inline-flex items-center gap-1.5 text-text-secondary">
                      {n.channel === "SMS" ? <MessageSquare size={14} strokeWidth={1.8} /> : <Mail size={14} strokeWidth={1.8} />}
                      {n.channel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-text-muted">Event</dt>
                    <dd className="text-text-secondary">{EVENT_LABEL[n.event] ?? n.event}</dd>
                  </div>
                </div>
                <div>
                  <dt className="text-[10px] text-text-muted">Recipient</dt>
                  <dd className="text-text-secondary">{n.recipient}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

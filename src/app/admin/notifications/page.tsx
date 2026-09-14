import { Bell, Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EVENT_LABEL: Record<string, string> = {
  RESULT_PUBLISHED: "Result published",
  PAYMENT_RECEIVED: "Payment received",
  ACCOUNT_CREATED: "Account created",
  PASSWORD_RESET: "Password reset",
};

export default async function NotificationsPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const notifications = await prisma.notification.findMany({
    where: { schoolId },
    include: { student: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

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
          <span className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption text-text-secondary">
            {notifications.length} {notifications.length === 1 ? "notification" : "notifications"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Date", "Student", "Channel", "Event", "Recipient", "Status"].map((h) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

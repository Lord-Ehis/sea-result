import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readEmailConfig } from "@/lib/email";
import { readSmsConfig } from "@/lib/sms";
import { emailSenderVerdict } from "@/lib/readiness-rules";
import { FAILED_MESSAGE_DAYS } from "@/lib/owner-attention";
import { eventLabel, isRetryableEvent, maskRecipient, summarizeFailures, type MessageChannel } from "@/lib/owner-messages";
import { FailuresPanel, TestMessagePanel, type SchoolFailureRow } from "./MessagesClient";

const fmt = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const thClass = "border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5";

export default async function OwnerMessagesPage() {
  // Every school's parents' contact details: check the role here as well as in the proxy.
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const now = new Date();
  const since = new Date(now.getTime() - FAILED_MESSAGE_DAYS * 86_400_000);
  const [byStatus, failed, recent, schools, email, sms] = await Promise.all([
    prisma.notification.groupBy({ by: ["channel", "status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.notification.findMany({ where: { status: "FAILED", createdAt: { gte: since } }, select: { schoolId: true, channel: true, event: true }, take: 5000 }),
    prisma.notification.findMany({
      where: { status: "FAILED", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { school: { select: { id: true, name: true } }, student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.school.findMany({ select: { id: true, name: true } }),
    readEmailConfig(),
    readSmsConfig(),
  ]);

  const name = new Map(schools.map((s) => [s.id, s.name]));
  const failures: SchoolFailureRow[] = summarizeFailures(failed.map((f) => ({ schoolId: f.schoolId, channel: f.channel as MessageChannel, event: f.event }))).map((s) => ({
    ...s,
    name: name.get(s.schoolId) ?? "Unknown school",
  }));
  const retryableTotal = failures.reduce((sum, s) => sum + s.retryable, 0);

  const count = (channel: MessageChannel, status: string) => byStatus.find((r) => r.channel === channel && r.status === status)?._count._all ?? 0;
  const channels: { channel: MessageChannel; label: string }[] = [
    { channel: "SMS", label: "SMS" },
    { channel: "EMAIL", label: "Email" },
  ];

  const emailVerdict = emailSenderVerdict(email?.from);

  return (
    <>
      <PageHeader eyebrow="Platform overview" title="Messages" intro="Whether SMS and email are reaching parents and staff, what failed, and a way to retry and to test. For the full provider checklist, see Go-live." />

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {channels.map(({ channel, label }) => {
          const sent = count(channel, "SENT");
          const bad = count(channel, "FAILED");
          const pend = count(channel, "PENDING");
          const total = sent + bad + pend;
          const failRate = total > 0 ? Math.round((bad / total) * 100) : 0;
          const configured = channel === "SMS" ? !!sms : !!email;
          return (
            <div key={channel} className="rounded-md border border-border bg-bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="m-0 text-heading font-medium text-text-primary">{label}</h2>
                {!configured ? <StatusPill label="Not set up" tone="danger" /> : bad > 0 && failRate >= 20 ? <StatusPill label={`${failRate}% failing`} tone="danger" /> : bad > 0 ? <StatusPill label={`${bad} failed`} tone="warning" /> : <StatusPill label="Working" tone="success" />}
              </div>
              <div className="mt-3 text-title font-medium tracking-tight text-text-primary tabular-nums">{sent.toLocaleString()} sent</div>
              <div className="text-caption text-text-muted">
                {bad.toLocaleString()} failed · {pend.toLocaleString()} pending · last {FAILED_MESSAGE_DAYS} days
              </div>
              <p className="m-0 mt-3 text-caption text-text-secondary">
                {!configured
                  ? `No ${label.toLowerCase()} provider keys are saved, so nothing can be sent.`
                  : channel === "EMAIL"
                    ? `Sending from ${email?.from}. ${emailVerdict.status === "ready" ? "" : emailVerdict.detail}`
                    : `Sending as "${sms?.senderId}". Messages only deliver once the provider has approved that sender ID.`}
              </p>
              {!configured && (
                <Link href="/owner/settings" className="mt-2 inline-block text-caption text-primary hover:underline">
                  Set it up in Global settings
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <FailuresPanel schools={failures} retryableTotal={retryableTotal} days={FAILED_MESSAGE_DAYS} />

      {recent.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="m-0 text-heading font-medium text-text-primary">Latest failures</h2>
            <p className="mt-1 text-caption text-text-muted">The {recent.length} most recent. Phone numbers and emails are partly hidden.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  {["When", "School", "Message", "To", "Channel"].map((h) => (
                    <th key={h} className={thClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((n) => (
                  <tr key={n.id} className="border-b border-[#f0f2f3] align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 pl-5 text-caption text-text-secondary">{fmt(n.createdAt)}</td>
                    <td className="px-4 py-3 text-caption">
                      <Link href={`/owner/schools/${n.school.id}`} className="text-primary hover:underline">
                        {n.school.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">
                      {eventLabel(n.event)}
                      {!isRetryableEvent(n.event) && <div className="text-[10px] text-text-muted">can&apos;t be re-sent</div>}
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">
                      {maskRecipient(n.recipient)}
                      {n.student && <div className="text-[10px] text-text-muted">for {n.student.firstName} {n.student.lastName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={n.channel === "SMS" ? "SMS" : "Email"} tone="neutral" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TestMessagePanel />
    </>
  );
}

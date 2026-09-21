import Link from "next/link";
import type { SchoolAccess } from "@/lib/school-access";

const dateLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// The heads-up an admin sees on every page as a subscription nears its end,
// runs into its grace period, or has lapsed. Nothing renders for a school that
// is comfortably covered.
export function SubscriptionBanner({ access, canRenew }: { access: SchoolAccess; canRenew: boolean }) {
  const { state, coverageEndsAt, graceEndsAt, daysLeft } = access;

  let tone: "warning" | "danger" | null = null;
  let text = "";
  if (state === "ACTIVE" && coverageEndsAt && daysLeft !== null && daysLeft <= 14) {
    tone = "warning";
    text = `Your subscription ends on ${dateLabel(coverageEndsAt)} (${daysLeft <= 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}).`;
  } else if (state === "GRACE" && coverageEndsAt && graceEndsAt) {
    tone = "danger";
    text = `Your subscription ended on ${dateLabel(coverageEndsAt)}. Everything keeps working until ${dateLabel(graceEndsAt)} — renew before then to avoid being locked out.`;
  } else if (state === "LAPSED") {
    tone = "danger";
    text = coverageEndsAt
      ? `Your school's subscription ended on ${dateLabel(coverageEndsAt)}. Renew to restore access for your teachers and staff.`
      : "Your school doesn't have an active subscription yet. Subscribe to start using the platform.";
  }
  if (!tone) return null;

  return (
    <div
      role="status"
      className={`mb-5 flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3 text-caption ${
        tone === "danger" ? "border-danger/30 bg-danger-bg text-danger" : "border-warning/30 bg-warning-bg text-warning"
      }`}
    >
      <span>{text}</span>
      {canRenew ? (
        <Link href="/admin/billing" className="font-medium underline underline-offset-2">
          Renew now
        </Link>
      ) : (
        <span>Ask your school&apos;s main administrator to renew.</span>
      )}
    </div>
  );
}

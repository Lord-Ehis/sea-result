import { DAY_MS, addDays } from "@/lib/add-months";

// Whether a school may use the platform right now. Pure — no database or clock
// access — so the rules are unit-tested and the request path, the banner, the
// owner's panel and the daily reminder job all agree.
//
//   ACTIVE     covered by a subscription
//   GRACE      the subscription ended within the last GRACE_DAYS; everything
//              still works, with a "renew now" banner
//   LAPSED     no subscription, or grace is over — staff can only reach Billing
//   SUSPENDED  switched off by the platform owner — staff are locked out
//
// Parents are never locked by either state (their published results stay
// available), so this only decides what admins and teachers can do.

export const GRACE_DAYS = 7;
export const REMINDER_DAYS = [14, 7, 1] as const;

export type SchoolAccessState = "ACTIVE" | "GRACE" | "LAPSED" | "SUSPENDED";

export type SubscriptionWindow = { status: "ACTIVE" | "EXPIRED" | "CANCELLED"; startDate: Date; endDate: Date };

export type SchoolAccess = {
  state: SchoolAccessState;
  /** End of the latest subscription (null when there has never been one). */
  coverageEndsAt: Date | null;
  /** Last day of the grace period (null when there is no coverage end). */
  graceEndsAt: Date | null;
  /** Whole days until coverage ends; negative once it has ended. Null with no subscription. */
  daysLeft: number | null;
};

export function resolveSchoolAccess(input: {
  status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
  subscriptions: SubscriptionWindow[];
  now: Date;
  graceDays?: number;
}): SchoolAccess {
  const graceDays = input.graceDays ?? GRACE_DAYS;

  // Subscriptions stack, so coverage runs to the latest end among the ones
  // that haven't been cancelled (an EXPIRED one is simply in the past).
  const ends = input.subscriptions.filter((s) => s.status !== "CANCELLED").map((s) => s.endDate.getTime());
  const coverageEndsAt = ends.length > 0 ? new Date(Math.max(...ends)) : null;
  const graceEndsAt = coverageEndsAt ? addDays(coverageEndsAt, graceDays) : null;
  const daysLeft = coverageEndsAt ? Math.floor((coverageEndsAt.getTime() - input.now.getTime()) / DAY_MS) : null;

  const base = { coverageEndsAt, graceEndsAt, daysLeft };
  if (input.status === "SUSPENDED") return { state: "SUSPENDED", ...base };
  // A school waiting on a deletion decision keeps working as before.
  if (input.status === "PENDING_DELETION") return { state: "ACTIVE", ...base };

  if (!coverageEndsAt) return { state: "LAPSED", ...base };
  if (input.now.getTime() <= coverageEndsAt.getTime()) return { state: "ACTIVE", ...base };
  if (input.now.getTime() <= graceEndsAt!.getTime()) return { state: "GRACE", ...base };
  return { state: "LAPSED", ...base };
}

/** What a signed-in person of a given role may do in a given state. */
export type AccessDecision = "allow" | "billing-only" | "blocked-suspended" | "blocked-lapsed";

export function decideAccess(role: "SCHOOL_ADMIN" | "TEACHER" | "PARENT" | "PLATFORM_OWNER", state: SchoolAccessState, path: string): AccessDecision {
  if (role === "PARENT" || role === "PLATFORM_OWNER") return "allow";
  if (state === "ACTIVE" || state === "GRACE") return "allow";
  if (state === "SUSPENDED") return "blocked-suspended";
  // LAPSED: an admin may only renew; a teacher can't do anything.
  if (role === "SCHOOL_ADMIN") return path === "/admin/billing" || path.startsWith("/admin/billing/") ? "allow" : "billing-only";
  return "blocked-lapsed";
}

/** The reminder milestones that are due now for a school whose coverage ends at `coverageEndsAt`. */
export type ReminderMilestone = "T-14" | "T-7" | "T-1" | "ENDED" | "LOCKED";

export function dueMilestones(access: SchoolAccess, now: Date): ReminderMilestone[] {
  if (!access.coverageEndsAt || access.state === "SUSPENDED") return [];
  const due: ReminderMilestone[] = [];
  const left = access.daysLeft ?? 0;
  if (access.state === "ACTIVE") {
    // Inside a window, but only the one that applies today (the job runs daily).
    if (left <= 14 && left > 7) due.push("T-14");
    else if (left <= 7 && left > 1) due.push("T-7");
    else if (left <= 1 && left >= 0) due.push("T-1");
  } else if (access.state === "GRACE") {
    due.push("ENDED");
  } else if (access.state === "LAPSED" && now.getTime() > access.graceEndsAt!.getTime()) {
    due.push("LOCKED");
  }
  return due;
}

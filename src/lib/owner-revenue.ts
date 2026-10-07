import { resolveSchoolAccess, type SchoolAccessState } from "@/lib/school-access";
import { termLabel, isTermNumber } from "@/lib/term-number";

// The platform owner's revenue and renewals report. Pure — no database or clock
// access — so how money is grouped, which schools are due to renew, and what
// goes into the CSV are all unit-tested; the page only fetches rows.

export type PaidPayment = {
  amount: number;
  paidAt: Date;
  schoolId: string;
  billingCycle: "PER_TERM" | "FULL_SESSION" | null;
  session: string | null;
  termNumber: number | null;
  isRegistration: boolean;
};

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

/** "2026-10" — months are cut in UTC so a payment never moves month between server and report. */
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** The last `count` month keys, oldest first, ending with the month of `now`. */
export function lastMonthKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  return keys;
}

export function revenueByMonth(payments: PaidPayment[], now: Date, months = 12): { key: string; label: string; total: number; count: number }[] {
  const buckets = new Map(lastMonthKeys(now, months).map((k) => [k, { key: k, label: monthLabel(k), total: 0, count: 0 }]));
  for (const p of payments) {
    const bucket = buckets.get(monthKey(p.paidAt));
    if (bucket) {
      bucket.total += p.amount;
      bucket.count += 1;
    }
  }
  return [...buckets.values()];
}

export type PeriodRevenue = { label: string; total: number; count: number; sortKey: string };

/** What each payment was for ("2026/2027 · 1st Term" or "· Full session"), newest session first. */
export function revenueByPeriod(payments: PaidPayment[]): PeriodRevenue[] {
  const groups = new Map<string, PeriodRevenue>();
  for (const p of payments) {
    let label = "Not labelled";
    let sortKey = "0000";
    if (p.session) {
      if (p.billingCycle === "FULL_SESSION") {
        label = `${p.session} · Full session`;
        sortKey = `${p.session}-9`;
      } else if (isTermNumber(p.termNumber)) {
        label = `${p.session} · ${termLabel(p.termNumber)}`;
        sortKey = `${p.session}-${p.termNumber}`;
      } else {
        label = `${p.session} · Term not recorded`;
        sortKey = `${p.session}-0`;
      }
    }
    const g = groups.get(label) ?? { label, total: 0, count: 0, sortKey };
    g.total += p.amount;
    g.count += 1;
    groups.set(label, g);
  }
  return [...groups.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export type SchoolRevenue = { schoolId: string; name: string; lifetime: number; last12: number; count: number; sharePct: number };

/** Revenue per school, biggest contributor over the last 12 months first. `sharePct` is of the last-12-month total. */
export function revenueBySchool(payments: PaidPayment[], names: Map<string, string>, now: Date): SchoolRevenue[] {
  const since = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1);
  const bySchool = new Map<string, { lifetime: number; last12: number; count: number }>();
  for (const p of payments) {
    const row = bySchool.get(p.schoolId) ?? { lifetime: 0, last12: 0, count: 0 };
    row.lifetime += p.amount;
    row.count += 1;
    if (p.paidAt.getTime() >= since) row.last12 += p.amount;
    bySchool.set(p.schoolId, row);
  }
  const last12Total = [...bySchool.values()].reduce((sum, r) => sum + r.last12, 0);
  return [...bySchool.entries()]
    .map(([schoolId, r]) => ({ schoolId, name: names.get(schoolId) ?? "Unknown school", ...r, sharePct: last12Total > 0 ? Math.round((r.last12 / last12Total) * 100) : 0 }))
    .sort((a, b) => b.last12 - a.last12 || b.lifetime - a.lifetime || a.name.localeCompare(b.name));
}

export function latestPaymentBySchool(payments: PaidPayment[]): Map<string, { amount: number; paidAt: Date }> {
  const latest = new Map<string, { amount: number; paidAt: Date }>();
  for (const p of payments) {
    const seen = latest.get(p.schoolId);
    if (!seen || p.paidAt > seen.paidAt) latest.set(p.schoolId, { amount: p.amount, paidAt: p.paidAt });
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Renewals
// ---------------------------------------------------------------------------

export type PlanKind = "PER_TERM" | "FULL_SESSION" | "FREE";
export const PLAN_LABEL: Record<PlanKind, string> = { PER_TERM: "Per term", FULL_SESSION: "Full session", FREE: "Free access" };

export type RenewalSchool = {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
  subscriptions: { status: "ACTIVE" | "EXPIRED" | "CANCELLED"; startDate: Date; endDate: Date; billingCycle: "PER_TERM" | "FULL_SESSION"; isComplimentary: boolean }[];
};

export type RenewalRow = { schoolId: string; name: string; coverageEndsAt: Date; daysLeft: number; state: SchoolAccessState; plan: PlanKind };

export type RenewalBuckets = {
  /** Coverage has already ended (in the grace period, or locked out). */
  ended: RenewalRow[];
  next30: RenewalRow[];
  next60: RenewalRow[];
  next90: RenewalRow[];
  /** Schools that have never had any subscription (listed on the Overview, not here). */
  neverSubscribed: number;
};

/**
 * Schools sorted by when their coverage runs out. Coverage stacks, so a school
 * that has already bought the next term simply has a later end date and drops
 * out of the window. Suspended schools are left out: that was deliberate.
 */
export function renewalsDue(schools: RenewalSchool[], now: Date): RenewalBuckets {
  const out: RenewalBuckets = { ended: [], next30: [], next60: [], next90: [], neverSubscribed: 0 };

  for (const school of schools) {
    if (school.status === "SUSPENDED") continue;
    const access = resolveSchoolAccess({ status: school.status, subscriptions: school.subscriptions, now });
    if (!access.coverageEndsAt || access.daysLeft === null) {
      out.neverSubscribed += 1;
      continue;
    }
    // The plan that runs the longest is the one that decides when they need to renew.
    const current = school.subscriptions.filter((s) => s.status !== "CANCELLED").sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];
    const plan: PlanKind = current.isComplimentary ? "FREE" : current.billingCycle;
    const row: RenewalRow = { schoolId: school.id, name: school.name, coverageEndsAt: access.coverageEndsAt, daysLeft: access.daysLeft, state: access.state, plan };

    if (access.daysLeft < 0) out.ended.push(row);
    else if (access.daysLeft <= 30) out.next30.push(row);
    else if (access.daysLeft <= 60) out.next60.push(row);
    else if (access.daysLeft <= 90) out.next90.push(row);
  }

  const soonest = (a: RenewalRow, b: RenewalRow) => a.coverageEndsAt.getTime() - b.coverageEndsAt.getTime() || a.name.localeCompare(b.name);
  for (const list of [out.ended, out.next30, out.next60, out.next90]) list.sort(soonest);
  // The ones that ended longest ago are the coldest; show the most recent first so there is still time to win them back.
  out.ended.reverse();
  return out;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * One CSV cell. Quotes anything with a comma, quote or line break, and defuses
 * a leading = + - @ so a school name can't run as a formula when opened in Excel.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

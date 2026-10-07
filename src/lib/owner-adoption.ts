import { DAY_MS } from "@/lib/add-months";

// How well each school is really using the platform, as one explainable rating.
// Pure — no database or clock access — so the rules are unit-tested and the
// ranked list and each school's own page always agree.
//
//   NEW         signed up in the last two weeks; too early to judge
//   SETTING_UP  still has no students, no teachers or no result template
//   ACTIVE      results were entered, changed, approved or published in the last 30 days
//   QUIET       nothing for 31–90 days (often just a school holiday)
//   DORMANT     nothing for over 90 days, or results were never entered
//   NOT_RATED   switched off, or waiting on a deletion decision

export const NEW_DAYS = 14;
export const ACTIVE_DAYS = 30;
export const QUIET_DAYS = 90;
export const PUBLISHED_WINDOW_DAYS = 90;

export type Health = "ACTIVE" | "QUIET" | "DORMANT" | "SETTING_UP" | "NEW" | "NOT_RATED";

export const HEALTH_LABEL: Record<Health, string> = {
  ACTIVE: "Active",
  QUIET: "Quiet",
  DORMANT: "Dormant",
  SETTING_UP: "Setting up",
  NEW: "New",
  NOT_RATED: "Not rated",
};

export const HEALTH_TONE: Record<Health, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  QUIET: "warning",
  DORMANT: "danger",
  SETTING_UP: "neutral",
  NEW: "neutral",
  NOT_RATED: "neutral",
};

/** Who most needs a nudge comes first. */
const ATTENTION_ORDER: Record<Health, number> = { DORMANT: 0, QUIET: 1, SETTING_UP: 2, NEW: 3, ACTIVE: 4, NOT_RATED: 5 };

export const HEALTHS = Object.keys(HEALTH_LABEL) as Health[];
export const isHealth = (v: unknown): v is Health => typeof v === "string" && v in HEALTH_LABEL;

export type AdoptionInput = {
  status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
  createdAt: Date;
  students: number;
  teachers: number;
  templates: number;
  /** The latest time anyone entered, changed, approved or published a result; null if never. */
  lastActivityAt: Date | null;
};

export const wholeDaysBetween = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

export function agoText(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function classifyAdoption(input: AdoptionInput, now: Date): { health: Health; reason: string } {
  if (input.status === "SUSPENDED") return { health: "NOT_RATED", reason: "Switched off" };
  if (input.status === "PENDING_DELETION") return { health: "NOT_RATED", reason: "Waiting on a deletion decision" };

  const age = wholeDaysBetween(input.createdAt, now);
  if (age < NEW_DAYS) return { health: "NEW", reason: `Signed up ${agoText(age)}` };

  const missing: string[] = [];
  if (input.students === 0) missing.push("no students");
  if (input.teachers === 0) missing.push("no teachers");
  if (input.templates === 0) missing.push("no result template");
  if (missing.length > 0) return { health: "SETTING_UP", reason: `Still has ${missing.join(", ")}` };

  if (!input.lastActivityAt) return { health: "DORMANT", reason: "Set up, but no results have ever been entered" };

  const idle = wholeDaysBetween(input.lastActivityAt, now);
  if (idle <= ACTIVE_DAYS) return { health: "ACTIVE", reason: `Results last worked on ${agoText(idle)}` };
  if (idle <= QUIET_DAYS) return { health: "QUIET", reason: `No result activity for ${idle} days` };
  return { health: "DORMANT", reason: `No result activity for ${idle} days` };
}

/** Whole-number percentage of students who have at least one parent linked; null when there are no students. */
export function parentCoverage(linkedStudents: number, students: number): number | null {
  if (students <= 0) return null;
  return Math.min(100, Math.round((linkedStudents / students) * 100));
}

export type RankedRow = { name: string; health: Health; lastActivityAt: Date | null };

/** The ranked list: schools needing a nudge first; within a rating, the longest-idle first, then by name. */
export function sortForAttention<T extends RankedRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byHealth = ATTENTION_ORDER[a.health] - ATTENTION_ORDER[b.health];
    if (byHealth !== 0) return byHealth;
    const ax = a.lastActivityAt?.getTime() ?? -Infinity;
    const bx = b.lastActivityAt?.getTime() ?? -Infinity;
    if (ax !== bx) return ax - bx;
    return a.name.localeCompare(b.name);
  });
}

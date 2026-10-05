import { prisma } from "@/lib/prisma";

// Reads the account_events trail (who replaced whose sign-in email). Pure
// pieces are separate so the page and the tests say the same thing.

export function emailChange(metadata: unknown): { from: string; to: string } {
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  return { from: typeof m.from === "string" ? m.from : "—", to: typeof m.to === "string" ? m.to : "—" };
}

export type AccountEventRow = {
  id: string;
  at: Date;
  account: string;
  changedBy: string;
  changedByRole: string | null;
  from: string;
  to: string;
};

export async function loadAccountEvents(schoolId: string, take = 50): Promise<AccountEventRow[]> {
  const events = await prisma.accountEvent.findMany({ where: { schoolId, action: "EMAIL_CHANGED" }, orderBy: { createdAt: "desc" }, take });
  if (events.length === 0) return [];

  const ids = [...new Set(events.flatMap((e) => [e.userId, e.actorUserId].filter((x): x is string => !!x)))];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  return events.map((e) => ({
    id: e.id,
    at: e.createdAt,
    account: nameOf.get(e.userId) ?? "Deleted account",
    changedBy: e.actorUserId ? (nameOf.get(e.actorUserId) ?? "Deleted account") : "—",
    changedByRole: e.actorRole === "PLATFORM_OWNER" ? "Platform team" : e.actorRole === "SCHOOL_ADMIN" ? "School admin" : null,
    ...emailChange(e.metadata),
  }));
}

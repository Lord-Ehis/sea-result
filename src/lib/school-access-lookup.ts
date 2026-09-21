import { prisma } from "@/lib/prisma";
import { resolveSchoolAccess, type SchoolAccess } from "@/lib/school-access";

// Loads what `resolveSchoolAccess` needs. The proxy asks on every page load and
// server action, so the answer is kept for a few seconds per server instance:
// a suspension or renewal takes effect within moments without a database query
// for each click. (Every instance ages its own copy out independently.)

const TTL_MS = 10_000;
const cache = new Map<string, { at: number; access: SchoolAccess }>();

export function forgetSchoolAccess(schoolId: string) {
  cache.delete(schoolId);
}

export async function getSchoolAccess(schoolId: string, opts: { fresh?: boolean } = {}): Promise<SchoolAccess> {
  const now = Date.now();
  const hit = cache.get(schoolId);
  if (!opts.fresh && hit && now - hit.at < TTL_MS) return hit.access;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { status: true, subscriptions: { select: { status: true, startDate: true, endDate: true } } },
  });
  // A school that no longer exists has nothing to be locked out of.
  const access = school
    ? resolveSchoolAccess({ status: school.status, subscriptions: school.subscriptions, now: new Date(now) })
    : resolveSchoolAccess({ status: "SUSPENDED", subscriptions: [], now: new Date(now) });

  cache.set(schoolId, { at: now, access });
  return access;
}

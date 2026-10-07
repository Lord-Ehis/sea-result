import { prisma } from "@/lib/prisma";
import { resolveSchoolAccess } from "@/lib/school-access";
import { PUBLISHED_WINDOW_DAYS, classifyAdoption, parentCoverage, type Health } from "@/lib/owner-adoption";

export type SchoolAdoption = {
  schoolId: string;
  name: string;
  health: Health;
  reason: string;
  students: number;
  teachers: number;
  templates: number;
  parentAccounts: number;
  studentsWithParent: number;
  /** Percentage of students with a parent linked; null when there are no students. */
  parentCoveragePct: number | null;
  /** Results published (latest versions only) in the last 90 days. */
  publishedRecently: number;
  /** Latest time anyone entered, changed, approved or published a result. */
  lastActivityAt: Date | null;
  coverageEndsAt: Date | null;
  daysLeft: number | null;
};

const asMap = <T extends { schoolId: string | null }>(rows: T[], pick: (row: T) => number) => new Map(rows.map((r) => [r.schoolId, pick(r)]));

/** One row per school (or just the one asked for), using a handful of grouped queries rather than one per school. */
export async function loadAdoption(opts: { schoolId?: string; now?: Date } = {}): Promise<SchoolAdoption[]> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - PUBLISHED_WINDOW_DAYS * 86_400_000);
  const only = opts.schoolId ? { schoolId: opts.schoolId } : {};
  const staffSchool = opts.schoolId ?? { not: null };

  const [schools, students, withParent, teachers, parents, templates, publishedRecent, publishedLatest, resultActivity] = await Promise.all([
    prisma.school.findMany({
      where: opts.schoolId ? { id: opts.schoolId } : {},
      select: { id: true, name: true, status: true, createdAt: true, subscriptions: { select: { status: true, startDate: true, endDate: true } } },
    }),
    prisma.student.groupBy({ by: ["schoolId"], where: { ...only, isActive: true }, _count: { _all: true } }),
    prisma.student.groupBy({ by: ["schoolId"], where: { ...only, isActive: true, parentLinks: { some: {} } }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["schoolId"], where: { schoolId: staffSchool, role: "TEACHER", isActive: true }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["schoolId"], where: { schoolId: staffSchool, role: "PARENT" }, _count: { _all: true } }),
    prisma.resultTemplate.groupBy({ by: ["schoolId"], where: only, _count: { _all: true } }),
    prisma.publishedResultSnapshot.groupBy({ by: ["schoolId"], where: { ...only, supersededAt: null, publishedAt: { gte: since } }, _count: { _all: true } }),
    prisma.publishedResultSnapshot.groupBy({ by: ["schoolId"], where: only, _max: { publishedAt: true } }),
    prisma.result.groupBy({ by: ["schoolId"], where: only, _max: { updatedAt: true } }),
  ]);

  const studentCount = asMap(students, (r) => r._count._all);
  const withParentCount = asMap(withParent, (r) => r._count._all);
  const teacherCount = asMap(teachers, (r) => r._count._all);
  const parentCount = asMap(parents, (r) => r._count._all);
  const templateCount = asMap(templates, (r) => r._count._all);
  const recentCount = asMap(publishedRecent, (r) => r._count._all);
  const latestPublished = new Map(publishedLatest.map((r) => [r.schoolId, r._max.publishedAt]));
  const latestResult = new Map(resultActivity.map((r) => [r.schoolId, r._max.updatedAt]));

  return schools.map((s) => {
    const published = latestPublished.get(s.id) ?? null;
    const edited = latestResult.get(s.id) ?? null;
    const lastActivityAt = published && edited ? (published > edited ? published : edited) : (published ?? edited);
    const studentsN = studentCount.get(s.id) ?? 0;
    const teachersN = teacherCount.get(s.id) ?? 0;
    const templatesN = templateCount.get(s.id) ?? 0;
    const withParentN = withParentCount.get(s.id) ?? 0;
    const access = resolveSchoolAccess({ status: s.status, subscriptions: s.subscriptions, now });
    const { health, reason } = classifyAdoption({ status: s.status, createdAt: s.createdAt, students: studentsN, teachers: teachersN, templates: templatesN, lastActivityAt }, now);

    return {
      schoolId: s.id,
      name: s.name,
      health,
      reason,
      students: studentsN,
      teachers: teachersN,
      templates: templatesN,
      parentAccounts: parentCount.get(s.id) ?? 0,
      studentsWithParent: withParentN,
      parentCoveragePct: parentCoverage(withParentN, studentsN),
      publishedRecently: recentCount.get(s.id) ?? 0,
      lastActivityAt,
      coverageEndsAt: access.coverageEndsAt,
      daysLeft: access.daysLeft,
    };
  });
}

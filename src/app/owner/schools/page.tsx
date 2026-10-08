import { prisma } from "@/lib/prisma";
import { SchoolsClient } from "./SchoolsClient";

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<{ deleted?: string; filesFailed?: string }> }) {
  const sp = await searchParams;
  const [schools, revenueBySchool] = await Promise.all([
    prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscriptions: { where: { status: "ACTIVE", startDate: { lte: new Date() } }, take: 1, orderBy: { endDate: "desc" } },
        _count: { select: { students: true, campuses: true } },
      },
    }),
    prisma.payment.groupBy({ by: ["schoolId"], where: { status: "SUCCESS" }, _sum: { amount: true } }),
  ]);

  const revenueMap = new Map(revenueBySchool.map((r) => [r.schoolId, r._sum.amount?.toNumber() ?? 0]));

  return (
    <>
      {sp.deleted && (
        <p className="mb-5 rounded-md bg-success-bg px-4 py-3 text-body text-success">
          {sp.deleted.slice(0, 200)} and all of its data have been deleted permanently.
          {sp.filesFailed ? " Some uploaded files could not be removed from storage; nothing links to them any more." : ""}
        </p>
      )}
      <SchoolsClient
        schools={schools.map((s) => {
          const sub = s.subscriptions[0];
          return {
            id: s.id,
            name: s.name,
            slug: s.slug,
            status: s.status,
            createdAt: s.createdAt.toISOString(),
            studentCount: s._count.students,
            campusCount: s._count.campuses,
            revenue: revenueMap.get(s.id) ?? 0,
            plan: sub ? { billingCycle: sub.billingCycle, endDate: sub.endDate.toISOString() } : null,
          };
        })}
      />
    </>
  );
}

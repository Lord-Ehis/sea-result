import { requireFullAdminPage } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { TeamClient } from "./TeamClient";

export default async function TeamPage() {
  const { schoolId } = await requireFullAdminPage();

  const [admins, campuses] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: "SCHOOL_ADMIN" },
      include: { campusAccess: { select: { campusId: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.campus.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <TeamClient
      campuses={campuses}
      admins={admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        isActive: a.isActive,
        campusScoped: a.campusScoped,
        campusIds: a.campusAccess.map((c) => c.campusId),
      }))}
    />
  );
}

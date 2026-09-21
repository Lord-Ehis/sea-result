import { getAdminAccess } from "@/lib/admin-access";
import { classWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { TeachersClient } from "./TeachersClient";

export default async function TeachersPage() {
  const access = await getAdminAccess();
  const { schoolId } = access;
  const scope = classWhere(access);

  // A campus admin sees only teachers who teach in their campuses, and only
  // those assignments — not which classes the same teacher has elsewhere.
  const [teachers, classes] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER", ...(access.campusIds === null ? {} : { teachingAssignments: { some: { class: scope } } }) },
      include: { teachingAssignments: { where: { class: scope }, include: { class: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.findMany({ where: { schoolId, ...scope }, orderBy: { name: "asc" } }),
  ]);

  return (
    <TeachersClient
      classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      teachers={teachers.map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        isActive: t.isActive,
        classIds: t.teachingAssignments.map((a) => a.classId),
        classNames: t.teachingAssignments.map((a) => a.class.name),
      }))}
    />
  );
}

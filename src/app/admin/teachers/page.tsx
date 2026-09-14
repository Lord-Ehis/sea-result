import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeachersClient } from "./TeachersClient";

export default async function TeachersPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const [teachers, classes] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      include: { teachingAssignments: { include: { class: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
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

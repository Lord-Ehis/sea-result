import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StudentsClient } from "./StudentsClient";

export default async function StudentsPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const [campuses, classes, students] = await Promise.all([
    prisma.campus.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.student.findMany({
      where: { schoolId },
      include: { campus: true, class: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (campuses.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="School management"
          title="Students & campuses"
          intro="Manage student records across every campus in one place."
        />
        <EmptyState
          icon={Users}
          title="Add a campus to get started"
          description="Students are enrolled into a campus. Add your first campus before adding student records."
        />
      </>
    );
  }

  return (
    <StudentsClient
      campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
      classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      students={students.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        studentCode: s.studentCode,
        className: s.class?.name ?? "—",
        classId: s.classId,
        campusName: s.campus.name,
        campusId: s.campusId,
        guardianName: s.guardianName,
        guardianPhone: s.guardianPhone,
        isActive: s.isActive,
      }))}
    />
  );
}

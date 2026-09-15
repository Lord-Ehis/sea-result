import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClassesClient } from "./ClassesClient";

export default async function ClassesPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const [campuses, classes] = await Promise.all([
    prisma.campus.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.class.findMany({
      where: { schoolId },
      include: { campus: true, _count: { select: { students: true } } },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
  ]);

  if (campuses.length === 0) {
    return (
      <>
        <PageHeader eyebrow="School management" title="Classes" intro="Set up the classes and levels your school uses." />
        <EmptyState
          icon={Layers}
          title="Add a campus first"
          description="Classes belong to a campus. Add a campus from the Students page before setting up classes."
        />
      </>
    );
  }

  return (
    <ClassesClient
      campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
      classes={classes.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        session: c.session,
        campusId: c.campusId,
        campusName: c.campus.name,
        studentCount: c._count.students,
      }))}
    />
  );
}

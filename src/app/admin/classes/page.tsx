import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAdminAccess } from "@/lib/admin-access";
import { campusWhere, classWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { ClassesClient } from "./ClassesClient";

export default async function ClassesPage() {
  const access = await getAdminAccess();
  const { schoolId } = access;

  const [campuses, classes] = await Promise.all([
    prisma.campus.findMany({ where: { schoolId, ...campusWhere(access) }, orderBy: { name: "asc" } }),
    prisma.class.findMany({
      where: { schoolId, ...classWhere(access) },
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
          title={access.campusIds === null ? "Add a campus first" : "No campuses assigned to you"}
          description={
            access.campusIds === null
              ? "Classes belong to a campus. Add a campus from the Students page before setting up classes."
              : "Ask the school's main administrator to give you access to a campus."
          }
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

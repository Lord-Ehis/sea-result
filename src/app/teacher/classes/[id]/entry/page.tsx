import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResultEntryClient } from "./ResultEntryClient";
import type { TemplateField } from "@/app/admin/result-templates/actions";

export default async function ResultEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params;
  const session = await auth();
  const schoolId = session!.user.schoolId!;
  const teacherId = session!.user.id;

  const assignment = await prisma.teacherClassAssignment.findFirst({
    where: { teacherId, classId },
  });

  const klass = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    include: { students: { orderBy: { firstName: "asc" } } },
  });

  if (!assignment || !klass) {
    return (
      <>
        <PageHeader eyebrow="Teacher workspace" title="Result entry" intro="This class isn't assigned to you." />
        <EmptyState icon={FileText} title="Not available" description="You don't have access to this class." />
      </>
    );
  }

  const template =
    (await prisma.resultTemplate.findFirst({ where: { schoolId, classId: klass.id, isActive: true } })) ??
    (await prisma.resultTemplate.findFirst({ where: { schoolId, classId: null, isActive: true } }));

  if (!template || !template.term) {
    return (
      <>
        <PageHeader
          eyebrow="Teacher workspace / My classes"
          title={`Result entry · ${klass.name}`}
          intro="No result template is ready for this class yet."
        />
        <EmptyState
          icon={FileText}
          title="No result template configured"
          description="Ask your school admin to create a result template for this class (with a term set) in Result templates."
        />
      </>
    );
  }

  const results = await prisma.result.findMany({
    where: {
      templateId: template.id,
      term: template.term,
      session: klass.session,
      studentId: { in: klass.students.map((s) => s.id) },
    },
  });
  const resultsByStudent = new Map(results.map((r) => [r.studentId, r]));

  return (
    <ResultEntryClient
      classId={klass.id}
      className={klass.name}
      templateId={template.id}
      templateName={template.name}
      term={template.term}
      session={klass.session}
      fields={Array.isArray(template.fields) ? (template.fields as unknown as TemplateField[]) : []}
      students={klass.students.map((s) => {
        const result = resultsByStudent.get(s.id);
        return {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          studentCode: s.studentCode,
          data: (result?.data as Record<string, string>) ?? {},
          status: result?.status ?? null,
          rejectionNote: result?.rejectionNote ?? null,
        };
      })}
    />
  );
}

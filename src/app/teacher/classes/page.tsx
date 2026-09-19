import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ClassStatus = "Not started" | "In progress" | "Submitted" | "Sent back for corrections";

function statusTone(status: ClassStatus): "success" | "warning" | "neutral" {
  if (status === "Submitted") return "success";
  if (status === "Sent back for corrections") return "warning";
  return "neutral";
}

export default async function MyClassesPage() {
  const session = await auth();
  const teacherId = session!.user.id;
  const schoolId = session!.user.schoolId!;

  const assignments = await prisma.teacherClassAssignment.findMany({
    where: { teacherId },
    include: {
      class: {
        include: { students: true, campus: true },
      },
    },
    orderBy: { class: { name: "asc" } },
  });

  if (assignments.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Teacher workspace" title="My classes" intro="Enter results for the classes assigned to you." />
        <EmptyState icon={GraduationCap} title="No classes assigned" description="Ask your school admin to assign you to a class." />
      </>
    );
  }

  const cards = await Promise.all(
    assignments.map(async ({ class: klass }) => {
      const template =
        (await prisma.resultTemplate.findFirst({ where: { schoolId, classId: klass.id, isActive: true } })) ??
        (klass.level
          ? await prisma.resultTemplate.findFirst({ where: { schoolId, classId: null, level: klass.level, isActive: true } })
          : null) ??
        (await prisma.resultTemplate.findFirst({ where: { schoolId, classId: null, level: null, isActive: true } }));

      let status: ClassStatus = "Not started";
      let completed = 0;

      if (template?.term) {
        const results = await prisma.result.findMany({
          where: {
            templateId: template.id,
            term: template.term,
            session: klass.session,
            studentId: { in: klass.students.map((s) => s.id) },
          },
        });
        completed = results.length;
        const allStudentsCovered = results.length === klass.students.length;
        if (results.some((r) => r.status === "REJECTED")) status = "Sent back for corrections";
        else if (allStudentsCovered && results.every((r) => r.status === "SUBMITTED" || r.status === "APPROVED" || r.status === "PUBLISHED")) status = "Submitted";
        else if (results.length > 0) status = "In progress";
      }

      return { klass, template, status, completed };
    }),
  );

  return (
    <>
      <PageHeader eyebrow="Teacher workspace" title="My classes" intro="Enter and submit results for your assigned classes in one place." />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ klass, template, status, completed }) => (
          <Link
            key={klass.id}
            href={`/teacher/classes/${klass.id}/entry`}
            className="block min-h-[170px] rounded-md border border-border bg-bg-card p-5 hover:border-primary/40 hover:bg-bg-page/40"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-primary-bg text-primary">
                <GraduationCap size={18} strokeWidth={1.8} />
              </span>
              <StatusPill label={status} tone={statusTone(status)} />
            </div>
            <h3 className="mt-4 mb-1.5 text-heading font-medium text-text-primary">{klass.name}</h3>
            <p className="m-0 text-caption text-text-muted">
              {template ? `${completed} of ${klass.students.length} students recorded` : "No result template configured yet"}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="flex items-center gap-1.5 text-caption text-text-secondary">
                <Users size={15} strokeWidth={1.8} />
                {klass.students.length} students
              </span>
              <ArrowRight size={16} strokeWidth={1.8} className="text-primary" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

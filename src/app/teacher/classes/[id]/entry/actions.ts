"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import type { TemplateField } from "@/app/admin/result-templates/actions";

async function requireTeacherForClass(classId: string) {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "TEACHER") {
    throw new Error("Not authorized.");
  }
  const assignment = await prisma.teacherClassAssignment.findFirst({
    where: { teacherId: session.user.id, classId },
  });
  if (!assignment) throw new Error("You are not assigned to this class.");
  return { id: session.user.id, schoolId: session.user.schoolId };
}

export async function saveClassResults(input: {
  classId: string;
  templateId: string;
  term: string;
  session: string;
  entries: { studentId: string; data: Record<string, string> }[];
  submit: boolean;
}) {
  const user = await requireTeacherForClass(input.classId);

  const template = await prisma.resultTemplate.findFirst({ where: { id: input.templateId, schoolId: user.schoolId } });
  const fields = Array.isArray(template?.fields) ? (template.fields as unknown as TemplateField[]) : [];
  const expandedFields = expandThisTermFields(fields);

  for (const entry of input.entries) {
    const data = computeOwnFields(expandedFields, entry.data);
    await prisma.result.upsert({
      where: {
        studentId_templateId_term_session: {
          studentId: entry.studentId,
          templateId: input.templateId,
          term: input.term,
          session: input.session,
        },
      },
      update: {
        data,
        status: input.submit ? "SUBMITTED" : "DRAFT",
        submittedByUserId: user.id,
        submittedAt: input.submit ? new Date() : undefined,
        rejectionNote: input.submit ? null : undefined,
      },
      create: {
        schoolId: user.schoolId,
        studentId: entry.studentId,
        templateId: input.templateId,
        term: input.term,
        session: input.session,
        data,
        status: input.submit ? "SUBMITTED" : "DRAFT",
        submittedByUserId: user.id,
        submittedAt: input.submit ? new Date() : null,
      },
    });
  }

  revalidatePath(`/teacher/classes/${input.classId}/entry`);
  revalidatePath("/teacher/classes");
}

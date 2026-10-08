import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExportInput } from "@/lib/school-export";

// Everything a school owns, for the owner's "download" and "delete permanently"
// tools. Deleting is explicit and ordered, child records first, instead of
// leaning on database cascades: several links (a result to its template, a
// deletion request to the person who made it) are "restrict", which makes a
// plain cascade fail or depend on luck.

type Db = Prisma.TransactionClient;

export type DataCounts = {
  students: number;
  classes: number;
  campuses: number;
  staff: number;
  parents: number;
  templates: number;
  results: number;
  publishedResults: number;
  payments: number;
  subscriptions: number;
  messages: number;
};

export async function countSchoolData(db: Pick<Db, "student" | "class" | "campus" | "user" | "resultTemplate" | "result" | "publishedResultSnapshot" | "payment" | "subscription" | "notification">, schoolId: string): Promise<DataCounts> {
  const [students, classes, campuses, staff, parents, templates, results, publishedResults, payments, subscriptions, messages] = await Promise.all([
    db.student.count({ where: { schoolId } }),
    db.class.count({ where: { schoolId } }),
    db.campus.count({ where: { schoolId } }),
    db.user.count({ where: { schoolId, role: { in: ["SCHOOL_ADMIN", "TEACHER"] } } }),
    db.user.count({ where: { schoolId, role: "PARENT" } }),
    db.resultTemplate.count({ where: { schoolId } }),
    db.result.count({ where: { schoolId } }),
    db.publishedResultSnapshot.count({ where: { schoolId } }),
    db.payment.count({ where: { schoolId } }),
    db.subscription.count({ where: { schoolId } }),
    db.notification.count({ where: { schoolId } }),
  ]);
  return { students, classes, campuses, staff, parents, templates, results, publishedResults, payments, subscriptions, messages };
}

/** What the school has actually paid, so a record of it survives in the owner's audit log. */
export async function paidTotal(db: Pick<Db, "payment">, schoolId: string): Promise<number> {
  const sum = await db.payment.aggregate({ where: { schoolId, status: "SUCCESS" }, _sum: { amount: true } });
  return Number(sum._sum.amount ?? 0);
}

/** Removes every row belonging to the school, then the school itself. Run inside a transaction. */
export async function deleteSchoolRows(tx: Db, schoolId: string): Promise<void> {
  const s = { schoolId };
  await tx.publishedResultSnapshot.deleteMany({ where: s });
  await tx.studentTermException.deleteMany({ where: s });
  await tx.resultEvent.deleteMany({ where: s });
  await tx.result.deleteMany({ where: s });
  await tx.resultBatch.deleteMany({ where: s });
  await tx.notification.deleteMany({ where: s });
  await tx.parentStudentLink.deleteMany({ where: { student: s } });
  await tx.teacherClassAssignment.deleteMany({ where: { class: s } });
  await tx.userCampusAccess.deleteMany({ where: { campus: s } });
  await tx.passwordResetToken.deleteMany({ where: { user: s } });
  await tx.deletionRequest.deleteMany({ where: s });
  await tx.payment.deleteMany({ where: s });
  await tx.subscription.deleteMany({ where: s });
  await tx.templateAssignment.deleteMany({ where: s });
  await tx.ratingItem.deleteMany({ where: s });
  await tx.ratingCategory.deleteMany({ where: s });
  await tx.assessmentComponent.deleteMany({ where: s });
  await tx.templateSection.deleteMany({ where: s });
  // A template points at its current version and a version at its template: break the loop first.
  await tx.resultTemplate.updateMany({ where: s, data: { currentVersionId: null } });
  await tx.templateVersion.deleteMany({ where: s });
  await tx.resultTemplate.deleteMany({ where: s });
  await tx.gradingScaleBand.deleteMany({ where: s });
  await tx.gradingScale.deleteMany({ where: s });
  await tx.subjectList.deleteMany({ where: s });
  await tx.annualSummarySettings.deleteMany({ where: s });
  await tx.accountEvent.deleteMany({ where: s });
  await tx.student.deleteMany({ where: s });
  await tx.class.deleteMany({ where: s });
  await tx.campus.deleteMany({ where: s });
  await tx.user.deleteMany({ where: s });
  await tx.school.delete({ where: { id: schoolId } });
}

/** Loads everything the export needs. Passwords, tokens and keys are never selected. */
export async function loadSchoolExportData(schoolId: string): Promise<ExportInput | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, slug: true, status: true, address: true, phone: true, supportEmail: true, principalName: true, createdAt: true },
  });
  if (!school) return null;
  const s = { schoolId };
  const [campuses, classes, students, users, parentLinks, teacherAssignments, templates, results, snapshots, subscriptions, payments, notifications, resultEvents, accountEvents] = await Promise.all([
    prisma.campus.findMany({ where: s, select: { id: true, name: true, address: true }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ where: s, select: { id: true, name: true, level: true, session: true, campusId: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({
      where: s,
      select: { id: true, studentCode: true, firstName: true, lastName: true, classId: true, campusId: true, isActive: true, dateOfBirth: true, gender: true, admissionNumber: true, guardianName: true, guardianPhone: true, guardianEmail: true },
      orderBy: { studentCode: "asc" },
    }),
    prisma.user.findMany({ where: s, select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, campusScoped: true, createdAt: true, campusAccess: { select: { campusId: true } } }, orderBy: { name: "asc" } }),
    prisma.parentStudentLink.findMany({ where: { student: s }, select: { parentUserId: true, studentId: true } }),
    prisma.teacherClassAssignment.findMany({ where: { class: s }, select: { teacherId: true, classId: true } }),
    prisma.resultTemplate.findMany({ where: s, select: { id: true, name: true, term: true, fields: true }, orderBy: { name: "asc" } }),
    prisma.result.findMany({ where: s, select: { id: true, studentId: true, templateId: true, term: true, session: true, status: true, data: true, submittedAt: true, approvedAt: true, publishedAt: true, rejectionNote: true } }),
    prisma.publishedResultSnapshot.findMany({ where: s, select: { resultId: true, studentId: true, version: true, verificationCode: true, publishedAt: true, supersededAt: true, amendmentReason: true }, orderBy: { publishedAt: "asc" } }),
    prisma.subscription.findMany({ where: s, select: { billingCycle: true, term: true, session: true, amount: true, discountNote: true, isComplimentary: true, status: true, startDate: true, endDate: true }, orderBy: { startDate: "asc" } }),
    prisma.payment.findMany({ where: s, select: { paystackReference: true, amount: true, currency: true, status: true, billingCycle: true, session: true, paidAt: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.notification.findMany({ where: s, select: { channel: true, event: true, recipient: true, status: true, createdAt: true, studentId: true }, orderBy: { createdAt: "asc" } }),
    prisma.resultEvent.findMany({ where: s, select: { action: true, resultId: true, actorUserId: true, actorRole: true, reason: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.accountEvent.findMany({ where: s, select: { userId: true, action: true, actorUserId: true, actorRole: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    school,
    campuses,
    classes,
    students,
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, isActive: u.isActive, campusScoped: u.campusScoped, createdAt: u.createdAt, campusIds: u.campusAccess.map((c) => c.campusId) })),
    parentLinks,
    teacherAssignments,
    templates,
    results,
    snapshots,
    subscriptions,
    payments,
    notifications,
    resultEvents,
    accountEvents,
  };
}

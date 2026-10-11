import type { Prisma } from "@prisma/client";
import { allocateCodes, codeHead, type CodeSeparator, type CodeYear, type StudentCodeSettings } from "@/lib/student-code";
import { UserError } from "@/lib/user-error";

type Db = Prisma.TransactionClient;

type SettingsRow = {
  studentCodeAuto: boolean;
  studentCodePrefix: string;
  studentCodeYear: string;
  studentCodeSeparator: string;
  studentCodeDigits: number;
  studentCodeNext: number;
};

const toSettings = (r: SettingsRow): StudentCodeSettings => ({
  auto: r.studentCodeAuto,
  prefix: r.studentCodePrefix,
  year: r.studentCodeYear as CodeYear,
  separator: r.studentCodeSeparator as CodeSeparator,
  digits: r.studentCodeDigits,
  next: r.studentCodeNext,
});

export const STUDENT_CODE_SELECT = { studentCodeAuto: true, studentCodePrefix: true, studentCodeYear: true, studentCodeSeparator: true, studentCodeDigits: true, studentCodeNext: true } as const;

export async function readStudentCodeSettings(db: Pick<Db, "school">, schoolId: string): Promise<StudentCodeSettings> {
  return toSettings(await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: STUDENT_CODE_SELECT }));
}

/**
 * Takes `count` new student codes for the school, inside the caller's transaction.
 * The school's row is locked while the numbers are chosen, so two people adding
 * students at the same moment are served one after the other and can never get
 * the same code. `alsoTaken` is for codes about to be saved in the same batch
 * (typed codes in an import file). The counter only ever moves up.
 */
export async function reserveStudentCodes(tx: Db, schoolId: string, count: number, alsoTaken: Iterable<string> = [], now = new Date()): Promise<string[]> {
  const rows = await tx.$queryRaw<SettingsRow[]>`
    SELECT "studentCodeAuto", "studentCodePrefix", "studentCodeYear", "studentCodeSeparator", "studentCodeDigits", "studentCodeNext"
    FROM schools WHERE id = ${schoolId} FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new UserError("School not found.");
  if (!row.studentCodeAuto) throw new UserError("Automatic student codes are not switched on. Type a student code.");
  const settings = toSettings(row);

  const head = codeHead(settings, now);
  const existing = await tx.student.findMany({ where: { schoolId, studentCode: { startsWith: head, mode: "insensitive" } }, select: { studentCode: true } });
  const taken = new Set<string>([...existing.map((s) => s.studentCode.toLowerCase()), ...[...alsoTaken].map((c) => c.toLowerCase())]);

  const { codes, next } = allocateCodes(count, settings, taken, now);
  await tx.school.update({ where: { id: schoolId }, data: { studentCodeNext: next } });
  return codes;
}

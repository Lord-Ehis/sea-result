import { zipSync, strToU8 } from "fflate";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { buildScoreSheet, toCsv } from "@/lib/score-csv";

// Turns one school's rows into a ZIP of spreadsheets (CSV, opens in Excel) the
// owner can hand to the school. Pure: the rows are loaded by school-data.ts, so
// every file's columns and rules are unit-tested here. Passwords, reset links,
// sign-in tokens and provider keys are never part of it.

const BOM = "﻿";
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const yesNo = (b: boolean) => (b ? "Yes" : "No");
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export type ExportInput = {
  school: { name: string; slug: string; status: string; address: string | null; phone: string | null; supportEmail: string | null; principalName: string | null; createdAt: Date };
  campuses: { id: string; name: string; address: string | null }[];
  classes: { id: string; name: string; level: string | null; session: string; campusId: string }[];
  students: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    classId: string | null;
    campusId: string;
    isActive: boolean;
    dateOfBirth: Date | null;
    gender: string | null;
    admissionNumber: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    guardianEmail: string | null;
  }[];
  users: { id: string; name: string; email: string; phone: string | null; role: string; isActive: boolean; campusScoped: boolean; createdAt: Date; campusIds: string[] }[];
  parentLinks: { parentUserId: string; studentId: string }[];
  teacherAssignments: { teacherId: string; classId: string }[];
  templates: { id: string; name: string; term: string | null; fields: unknown }[];
  results: { id: string; studentId: string; templateId: string; term: string; session: string; status: string; data: unknown; submittedAt: Date | null; approvedAt: Date | null; publishedAt: Date | null; rejectionNote: string | null }[];
  snapshots: { resultId: string; studentId: string; version: number; verificationCode: string; publishedAt: Date; supersededAt: Date | null; amendmentReason: string | null }[];
  subscriptions: { billingCycle: string; term: string | null; session: string; amount: unknown; discountNote: string | null; isComplimentary: boolean; status: string; startDate: Date; endDate: Date }[];
  payments: { paystackReference: string; amount: unknown; currency: string; status: string; billingCycle: string | null; session: string | null; paidAt: Date | null; createdAt: Date }[];
  notifications: { channel: string; event: string; recipient: string; status: string; createdAt: Date; studentId: string | null }[];
  resultEvents: { action: string; resultId: string | null; actorUserId: string | null; actorRole: string | null; reason: string | null; createdAt: Date }[];
  accountEvents: { userId: string; action: string; actorUserId: string | null; actorRole: string | null; createdAt: Date }[];
};

const sheet = (rows: string[][]) => BOM + toCsv(rows);

/** A safe file name part: letters and digits only, never empty, capped. */
export function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "untitled";
}

export function buildSchoolExport(input: ExportInput, now: Date): { files: Record<string, string>; counts: Record<string, number> } {
  const campus = new Map(input.campuses.map((c) => [c.id, c.name]));
  const klass = new Map(input.classes.map((c) => [c.id, c.name]));
  const student = new Map(input.students.map((s) => [s.id, s]));
  const user = new Map(input.users.map((u) => [u.id, u]));
  const template = new Map(input.templates.map((t) => [t.id, t]));
  const studentName = (id: string | null) => {
    const s = id ? student.get(id) : undefined;
    return s ? `${s.firstName} ${s.lastName}` : "";
  };
  const personName = (id: string | null) => (id ? (user.get(id)?.name ?? "Deleted account") : "");

  const files: Record<string, string> = {};

  files["school.csv"] = sheet([
    ["Name", "Web address name", "Status", "Address", "Phone", "Support email", "Principal", "Registered on"],
    [input.school.name, input.school.slug, input.school.status, text(input.school.address), text(input.school.phone), text(input.school.supportEmail), text(input.school.principalName), day(input.school.createdAt)],
  ]);

  files["campuses.csv"] = sheet([["Campus", "Address"], ...input.campuses.map((c) => [c.name, text(c.address)])]);
  files["classes.csv"] = sheet([["Class", "Level", "Session", "Campus"], ...input.classes.map((c) => [c.name, text(c.level), c.session, campus.get(c.campusId) ?? ""])]);

  files["students.csv"] = sheet([
    ["Student code", "First name", "Last name", "Class", "Campus", "Active", "Date of birth", "Gender", "Admission number", "Guardian name", "Guardian phone", "Guardian email"],
    ...input.students.map((s) => [s.studentCode, s.firstName, s.lastName, s.classId ? (klass.get(s.classId) ?? "") : "", campus.get(s.campusId) ?? "", yesNo(s.isActive), day(s.dateOfBirth), text(s.gender), text(s.admissionNumber), text(s.guardianName), text(s.guardianPhone), text(s.guardianEmail)]),
  ]);

  const staff = input.users.filter((u) => u.role === "SCHOOL_ADMIN" || u.role === "TEACHER");
  const classesOf = new Map<string, string[]>();
  for (const a of input.teacherAssignments) classesOf.set(a.teacherId, [...(classesOf.get(a.teacherId) ?? []), klass.get(a.classId) ?? ""]);
  files["staff.csv"] = sheet([
    ["Name", "Email", "Phone", "Role", "Active", "Limited to campuses", "Classes (teachers)", "Account created"],
    ...staff.map((u) => [
      u.name,
      u.email,
      text(u.phone),
      u.role === "SCHOOL_ADMIN" ? "School admin" : "Teacher",
      yesNo(u.isActive),
      u.campusScoped ? u.campusIds.map((id) => campus.get(id) ?? "").join("; ") : "",
      (classesOf.get(u.id) ?? []).join("; "),
      day(u.createdAt),
    ]),
  ]);

  const childrenOf = new Map<string, string[]>();
  for (const l of input.parentLinks) childrenOf.set(l.parentUserId, [...(childrenOf.get(l.parentUserId) ?? []), student.get(l.studentId)?.studentCode ?? ""]);
  files["parents.csv"] = sheet([
    ["Name", "Email", "Phone", "Active", "Linked student codes", "Account created"],
    ...input.users.filter((u) => u.role === "PARENT").map((u) => [u.name, u.email, text(u.phone), yesNo(u.isActive), (childrenOf.get(u.id) ?? []).join("; "), day(u.createdAt)]),
  ]);

  files["results.csv"] = sheet([
    ["Student code", "Student", "Class", "Template", "Term", "Session", "Status", "Submitted", "Approved", "Published", "Sent-back note"],
    ...input.results.map((r) => {
      const s = student.get(r.studentId);
      return [s?.studentCode ?? "", studentName(r.studentId), s?.classId ? (klass.get(s.classId) ?? "") : "", template.get(r.templateId)?.name ?? "", r.term, r.session, r.status, iso(r.submittedAt), iso(r.approvedAt), iso(r.publishedAt), text(r.rejectionNote)];
    }),
  ]);

  // One readable score sheet per template + term + session, the same layout teachers import.
  const groups = new Map<string, ExportInput["results"]>();
  for (const r of input.results) {
    const key = `${r.templateId}|${r.term}|${r.session}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const used = new Set<string>();
  for (const [, rows] of groups) {
    const t = template.get(rows[0].templateId);
    if (!t || !Array.isArray(t.fields)) continue;
    const rowStudents = rows.flatMap((r) => {
      const s = student.get(r.studentId);
      return s ? [{ id: s.id, name: `${s.firstName} ${s.lastName}`, studentCode: s.studentCode }] : [];
    });
    const data: Record<string, Record<string, string>> = {};
    for (const r of rows) data[r.studentId] = r.data && typeof r.data === "object" && !Array.isArray(r.data) ? (r.data as Record<string, string>) : {};
    let name = `scores/${slug(t.name)}-${slug(rows[0].term)}-${slug(rows[0].session)}`;
    for (let n = 2; used.has(name); n++) name = `scores/${slug(t.name)}-${slug(rows[0].term)}-${slug(rows[0].session)}-${n}`;
    used.add(name);
    files[`${name}.csv`] = buildScoreSheet(t.fields as unknown as TemplateField[], rowStudents, data);
  }

  files["published-results.csv"] = sheet([
    ["Student code", "Student", "Template", "Term", "Session", "Version", "Verification code", "Published", "Replaced on", "Reason for correction"],
    ...input.snapshots.map((p) => {
      const r = input.results.find((x) => x.id === p.resultId);
      return [student.get(p.studentId)?.studentCode ?? "", studentName(p.studentId), r ? (template.get(r.templateId)?.name ?? "") : "", r?.term ?? "", r?.session ?? "", String(p.version), p.verificationCode, iso(p.publishedAt), iso(p.supersededAt), text(p.amendmentReason)];
    }),
  ]);

  files["subscriptions.csv"] = sheet([
    ["Billing cycle", "Term", "Session", "Amount", "Status", "Free access", "Note", "Starts", "Ends"],
    ...input.subscriptions.map((s) => [s.billingCycle, text(s.term), s.session, text(s.amount), s.status, yesNo(s.isComplimentary), text(s.discountNote), day(s.startDate), day(s.endDate)]),
  ]);
  files["payments.csv"] = sheet([
    ["Reference", "Amount", "Currency", "Status", "Billing cycle", "Session", "Paid", "Started"],
    ...input.payments.map((p) => [p.paystackReference, text(p.amount), p.currency, p.status, text(p.billingCycle), text(p.session), iso(p.paidAt), iso(p.createdAt)]),
  ]);

  files["messages.csv"] = sheet([
    ["When", "Channel", "Message type", "To", "For student", "Status"],
    ...input.notifications.map((n) => [iso(n.createdAt), n.channel, n.event, n.recipient, studentName(n.studentId), n.status]),
  ]);

  const history = [
    ...input.resultEvents.map((e) => ({ at: e.createdAt, what: `Result ${e.action.toLowerCase().replace(/_/g, " ")}`, who: personName(e.actorUserId), detail: text(e.reason) })),
    ...input.accountEvents.map((e) => ({ at: e.createdAt, what: `Account ${e.action.toLowerCase().replace(/_/g, " ")}`, who: personName(e.actorUserId), detail: personName(e.userId) })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  files["history.csv"] = sheet([["When", "What", "Who", "Detail"], ...history.map((h) => [iso(h.at), h.what, h.who, h.detail])]);

  // Everything exactly as stored, for a full backup or to import elsewhere later.
  files["raw/results.json"] = JSON.stringify(
    input.results.map((r) => ({ id: r.id, studentCode: student.get(r.studentId)?.studentCode ?? null, template: template.get(r.templateId)?.name ?? null, term: r.term, session: r.session, status: r.status, data: r.data })),
    null,
    2,
  );
  files["raw/templates.json"] = JSON.stringify(
    input.templates.map((t) => ({ id: t.id, name: t.name, term: t.term, fields: t.fields })),
    null,
    2,
  );

  const counts = { students: input.students.length, staff: staff.length, parents: input.users.filter((u) => u.role === "PARENT").length, results: input.results.length, payments: input.payments.length };
  files["README.txt"] = [
    `Data for ${input.school.name}`,
    `Exported ${now.toISOString().slice(0, 10)} from Sophie Educational Assistant.`,
    "",
    "Open the .csv files in Excel or Google Sheets. They are UTF-8; if names look odd, import them as UTF-8.",
    "",
    "school.csv            The school's profile.",
    "campuses.csv, classes.csv",
    "students.csv          Every student with class, campus and guardian contact details.",
    "staff.csv             School admins and teachers (no passwords are ever included).",
    "parents.csv           Parent accounts and the student codes linked to them.",
    "results.csv           One line per result with its status and dates.",
    "scores/               One score sheet per template, term and session, in the same layout teachers import.",
    "published-results.csv Every published result, including corrected versions, with its verification code.",
    "subscriptions.csv, payments.csv",
    "messages.csv          SMS and email notifications that were sent.",
    "history.csv           Result submissions, approvals, publications and account changes.",
    "raw/                  The results and templates exactly as stored (JSON), for a full backup.",
    "",
    `Contents: ${counts.students} students, ${counts.staff} staff, ${counts.parents} parents, ${counts.results} results, ${counts.payments} payments.`,
    "",
    "This file contains children's names and parents' contact details. Keep it private and share it only with the school.",
  ].join("\r\n");

  return { files, counts };
}

/** The files as a ZIP, folders and all. */
export function zipFiles(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) entries[name] = strToU8(content);
  return zipSync(entries, { level: 6 });
}

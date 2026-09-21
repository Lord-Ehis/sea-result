import type { Prisma, ResultEventAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AdminAccess } from "@/lib/admin-access";
import { batchWhere } from "@/lib/campus-scope";
import { ACTION_LABEL, describeEvent, eventStudentId } from "@/lib/audit-describe";

// The audit trail as the School Admin sees it and exports it: the
// append-only `result_events` rows, joined to the people and batches they
// refer to. One query path for the page and the CSV so they always agree.

export const AUDIT_ACTIONS = Object.keys(ACTION_LABEL) as ResultEventAction[];
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_CAP = 10_000;

export type AuditFilters = { action?: ResultEventAction; classId?: string; from?: Date; to?: Date; actorUserId?: string };

function parseDate(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseAuditFilters(sp: { action?: string; classId?: string; from?: string; to?: string; actor?: string }): AuditFilters {
  return {
    action: AUDIT_ACTIONS.includes(sp.action as ResultEventAction) ? (sp.action as ResultEventAction) : undefined,
    classId: sp.classId || undefined,
    from: parseDate(sp.from, false),
    to: parseDate(sp.to, true),
    actorUserId: sp.actor || undefined,
  };
}

// Events belong to a batch, and a batch to a class and campus. A campus admin
// therefore sees only events of batches in their own campuses (an event has no
// relation to join on, so the in-scope batch ids are resolved first).
async function where(access: AdminAccess, f: AuditFilters): Promise<Prisma.ResultEventWhereInput> {
  const { schoolId } = access;
  const clause: Prisma.ResultEventWhereInput = { schoolId };
  if (f.action) clause.action = f.action;
  if (f.actorUserId) clause.actorUserId = f.actorUserId;
  if (f.from || f.to) clause.createdAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  if (f.classId || access.campusIds !== null) {
    const batches = await prisma.resultBatch.findMany({
      where: { schoolId, ...batchWhere(access), ...(f.classId ? { classId: f.classId } : {}) },
      select: { id: true },
    });
    clause.batchId = { in: batches.map((b) => b.id) };
  }
  return clause;
}

export type AuditRow = {
  id: string;
  at: Date;
  action: string;
  actionLabel: string;
  className: string;
  template: string;
  term: string;
  student: string;
  actor: string;
  actorRole: string;
  reason: string;
  templateVersion: string;
  summary: string;
};

export async function countAudit(access: AdminAccess, f: AuditFilters): Promise<number> {
  return prisma.resultEvent.count({ where: await where(access, f) });
}

export async function loadAudit(access: AdminAccess, f: AuditFilters, opts: { skip: number; take: number }): Promise<AuditRow[]> {
  const events = await prisma.resultEvent.findMany({
    where: await where(access, f),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: opts.skip,
    take: opts.take,
  });

  const batchIds = [...new Set(events.map((e) => e.batchId))];
  const actorIds = [...new Set(events.map((e) => e.actorUserId).filter((id): id is string => !!id))];
  const versionIds = [...new Set(events.map((e) => e.templateVersionId).filter((id): id is string => !!id))];
  const resultIds = [...new Set(events.map((e) => e.resultId).filter((id): id is string => !!id))];
  const metaStudentIds = events.map((e) => eventStudentId(e.metadata)).filter((id): id is string => !!id);

  const [batches, actors, versions, results, metaStudents] = await Promise.all([
    prisma.resultBatch.findMany({ where: { id: { in: batchIds } }, include: { class: { select: { name: true } }, template: { select: { name: true } } } }),
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }),
    prisma.templateVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, versionNumber: true } }),
    prisma.result.findMany({ where: { id: { in: resultIds } }, select: { id: true, student: { select: { firstName: true, lastName: true } } } }),
    prisma.student.findMany({ where: { id: { in: metaStudentIds } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const batch = new Map(batches.map((b) => [b.id, b]));
  const actor = new Map(actors.map((a) => [a.id, a.name]));
  const version = new Map(versions.map((v) => [v.id, v.versionNumber]));
  const resultStudent = new Map(results.map((r) => [r.id, `${r.student.firstName} ${r.student.lastName}`]));
  const student = new Map(metaStudents.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

  return events.map((e) => {
    const b = batch.get(e.batchId);
    const metaStudent = eventStudentId(e.metadata);
    return {
      id: e.id,
      at: e.createdAt,
      action: e.action,
      actionLabel: ACTION_LABEL[e.action] ?? e.action,
      className: b?.class.name ?? "—",
      template: b?.template.name ?? "—",
      term: b ? `${b.term} · ${b.session}` : "—",
      student: (e.resultId && resultStudent.get(e.resultId)) || (metaStudent && student.get(metaStudent)) || "",
      actor: (e.actorUserId && actor.get(e.actorUserId)) || (e.actorRole ? "—" : "System"),
      actorRole: e.actorRole ? e.actorRole.replace("_", " ").toLowerCase() : "",
      reason: e.reason ?? "",
      templateVersion: e.templateVersionId && version.has(e.templateVersionId) ? `v${version.get(e.templateVersionId)}` : "",
      summary: describeEvent(e.action, e.metadata),
    };
  });
}

import { auth } from "@/lib/auth";
import { AUDIT_EXPORT_CAP, loadAudit, parseAuditFilters } from "@/lib/audit-query";
import { toCsv } from "@/lib/score-csv";

// The audit log as a CSV, with the same filters as the page (capped so one
// click can't pull the whole history in a single response).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    return new Response("Not authorized.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const filters = parseAuditFilters({
    action: params.get("action") ?? undefined,
    classId: params.get("classId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    actor: params.get("actor") ?? undefined,
  });
  const rows = await loadAudit(session.user.schoolId, filters, { skip: 0, take: AUDIT_EXPORT_CAP });

  const csv =
    "﻿" +
    toCsv([
      ["When (UTC)", "Action", "Class", "Template", "Term", "Template version", "Student", "Done by", "Role", "Reason", "Details"],
      ...rows.map((r) => [r.at.toISOString(), r.actionLabel, r.className, r.template, r.term, r.templateVersion, r.student, r.actor, r.actorRole, r.reason, r.summary]),
    ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

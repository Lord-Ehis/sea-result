import type { Prisma, ResultEventAction, Role } from "@prisma/client";

// The audit trail: who moved a batch through the workflow, when, why, and
// under which template version. Append-only (a database trigger blocks
// UPDATE). Pass the transaction client so an event commits or rolls back
// together with the state change it describes.
export async function recordResultEvent(
  db: Pick<Prisma.TransactionClient, "resultEvent">,
  input: {
    schoolId: string;
    batchId: string;
    resultId?: string | null;
    action: ResultEventAction;
    actorUserId: string | null;
    actorRole: Role | null;
    reason?: string | null;
    templateVersionId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await db.resultEvent.create({
    data: {
      schoolId: input.schoolId,
      batchId: input.batchId,
      resultId: input.resultId ?? null,
      action: input.action,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      reason: input.reason ?? null,
      templateVersionId: input.templateVersionId ?? null,
      metadata: input.metadata,
    },
  });
}

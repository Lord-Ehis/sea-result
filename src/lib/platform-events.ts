import type { Prisma, PlatformEventAction } from "@prisma/client";

// Writes the platform owner's audit entries (see owner-audit.ts for how they
// read). Pass a transaction client when the entry belongs with a change, so
// both commit or neither does. Never put a secret in `metadata`.
export async function recordPlatformEvent(
  db: Pick<Prisma.TransactionClient, "platformEvent">,
  input: { action: PlatformEventAction; actorUserId: string; schoolId?: string | null; targetUserId?: string | null; metadata?: Prisma.InputJsonValue },
) {
  await db.platformEvent.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId,
      schoolId: input.schoolId ?? null,
      targetUserId: input.targetUserId ?? null,
      metadata: input.metadata,
    },
  });
}

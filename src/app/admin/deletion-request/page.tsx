import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeletionRequestClient } from "./DeletionRequestClient";

export default async function DeletionRequestPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const [latestRequest, studentCount, resultCount] = await Promise.all([
    prisma.deletionRequest.findFirst({
      where: { schoolId },
      orderBy: { requestedAt: "desc" },
      include: { resolvedBy: true },
    }),
    prisma.student.count({ where: { schoolId } }),
    prisma.result.count({ where: { schoolId } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="School workspace"
        title="Request account deletion"
        intro="Deletion requires Platform Owner approval — this can't be undone once approved."
      />
      <DeletionRequestClient
        studentCount={studentCount}
        resultCount={resultCount}
        request={
          latestRequest
            ? {
                id: latestRequest.id,
                status: latestRequest.status,
                reason: latestRequest.reason,
                requestedAt: latestRequest.requestedAt.toISOString(),
                resolvedAt: latestRequest.resolvedAt?.toISOString() ?? null,
                resolutionNote: latestRequest.resolutionNote,
                resolvedByName: latestRequest.resolvedBy?.name ?? null,
              }
            : null
        }
      />
    </>
  );
}

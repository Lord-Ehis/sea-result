import Link from "next/link";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAdminAccess } from "@/lib/admin-access";
import { classWhere, ofStudentWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { fieldsAsPublished } from "@/lib/published-fields";
import { findAnnualGrid } from "@/lib/annual-summary";
import { termNumberFromLabel } from "@/lib/term-number";
import type { SnapshotPayload } from "@/lib/snapshot";
import { AmendClient } from "./AmendClient";

export default async function AmendResultPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  const access = await getAdminAccess();
  const { schoolId } = access;

  const result = await prisma.result.findFirst({
    where: { id: resultId, schoolId, ...ofStudentWhere(access), status: "PUBLISHED" },
    include: { student: true, batch: { include: { class: true, template: true } } },
  });
  const snapshots = result
    ? await prisma.publishedResultSnapshot.findMany({ where: { resultId: result.id, schoolId }, orderBy: { version: "desc" } })
    : [];
  const current = snapshots.find((s) => !s.supersededAt) ?? null;

  if (!result || !result.batch || !current) {
    return (
      <>
        <PageHeader eyebrow="School workspace / Published results" title="Correct a result" intro="This result can't be corrected here." />
        <EmptyState icon={BadgeCheck} title="Not available" description="Only published results can be corrected. Results under review are edited on the review page." />
      </>
    );
  }

  const fields = await fieldsAsPublished(current.templateVersionId, result.batch.template.fields);
  const termNumber = result.batch.termNumber ?? termNumberFromLabel(result.batch.term);
  const annualEnabled = !!findAnnualGrid(fields);

  const [classes, users] = await Promise.all([
    prisma.class.findMany({ where: { schoolId, ...classWhere(access) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { id: { in: snapshots.map((s) => s.amendedByUserId).filter((id): id is string => !!id) } }, select: { id: true, name: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const payload = current.payload as unknown as SnapshotPayload;

  return (
    <>
      <Link href={`/admin/published/${result.batch.id}`} className="mb-5 inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-primary">
        <ArrowLeft size={15} strokeWidth={1.8} />
        Back to {result.batch.class.name} · {result.batch.term}
      </Link>
      <PageHeader
        eyebrow="School workspace / Published results"
        title={`Correct result · ${result.student.firstName} ${result.student.lastName}`}
        intro={`${payload.template.name} · ${result.batch.term} · ${result.batch.session}. Changes are issued as version ${current.version + 1}; version ${current.version} is kept.`}
      />
      <AmendClient
        resultId={result.id}
        studentName={`${result.student.firstName} ${result.student.lastName}`}
        snapshotId={current.id}
        currentVersion={current.version}
        fields={fields}
        initialData={(result.data as Record<string, string>) ?? {}}
        annual={annualEnabled && termNumber === 3 ? { promotionStatus: result.promotionStatus, promotedToClassId: result.promotedToClassId } : null}
        earlierTermAnnualNote={annualEnabled && (termNumber === 1 || termNumber === 2)}
        classes={classes}
        backHref={`/admin/published/${result.batch.id}`}
        history={snapshots.map((s) => ({
          id: s.id,
          version: s.version,
          issuedAt: s.createdAt.toISOString(),
          reason: s.amendmentReason,
          by: s.amendedByUserId ? (userName.get(s.amendedByUserId) ?? "—") : null,
          current: !s.supersededAt,
          supersededAt: s.supersededAt?.toISOString() ?? null,
          verificationCode: s.verificationCode,
        }))}
      />
    </>
  );
}

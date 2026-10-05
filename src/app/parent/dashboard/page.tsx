import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParentDashboardClient } from "./ParentDashboardClient";
import { isSnapshotIntact, type SnapshotPayload } from "@/lib/snapshot";

export default async function ParentDashboardPage() {
  const session = await auth();
  const parentUserId = session!.user.id;

  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId },
    include: { student: { include: { class: true, campus: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (links.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Parent workspace" title="Your children" intro="View results for every child linked to your account." />
        <EmptyState icon={LayoutGrid} title="No children linked yet" description="Link a child using their student code to see their results." />
        <Link
          href="/parent/link-child"
          className="mt-5 inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-body font-medium text-white hover:bg-primary-hover"
        >
          Link a child
        </Link>
      </>
    );
  }

  const familyChildren = await Promise.all(
    links.map(async ({ student }) => {
      // Parents see the frozen snapshot, never the live template — so editing
      // a template later can't change a published result.
      const snapshots = await prisma.publishedResultSnapshot.findMany({
        where: { studentId: student.id, supersededAt: null },
        orderBy: { publishedAt: "desc" },
      });

      return {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        className: student.class?.name ?? "No class",
        campusName: student.campus.name,
        results: snapshots.map((snap) => {
          const payload = snap.payload as unknown as SnapshotPayload;
          const intact = isSnapshotIntact(snap);
          return {
            templateId: payload.template.id,
            templateName: payload.template.name,
            term: payload.period.term,
            session: payload.period.session ?? null,
            publishedAt: snap.publishedAt.toISOString(),
            snapshotId: snap.id,
            verificationCode: snap.verificationCode,
            intact,
            fields: intact ? payload.fields : [],
            grids: intact ? payload.grids : [],
            ratingGrids: intact ? (payload.ratingGrids ?? []) : [],
            attendance: intact ? (payload.attendance ?? null) : null,
            gradeAnalysis: intact ? (payload.gradeAnalysis ?? null) : null,
            remarks: intact ? (payload.remarks ?? null) : null,
            performanceSummary: intact ? (payload.performanceSummary ?? null) : null,
            gradingScale: intact ? (payload.gradingScale ?? []) : [],
            annual: intact ? (payload.annual ?? null) : null,
          };
        }),
      };
    }),
  );

  return <ParentDashboardClient students={familyChildren} />;
}

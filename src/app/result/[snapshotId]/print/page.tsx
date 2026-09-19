import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SnapshotView } from "@/components/results/SnapshotView";
import { isSnapshotIntact, type SnapshotPayload } from "@/lib/snapshot";
import { verifySnapshotToken } from "@/lib/snapshot-token";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Student result", robots: { index: false, follow: false } };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
      <div className="rounded-md border border-border bg-bg-card p-6 text-center">
        <h1 className="m-0 text-heading font-medium text-text-primary">{title}</h1>
        <p className="mt-2 text-body text-text-secondary">{children}</p>
      </div>
    </main>
  );
}

// A printable, frozen copy of one published result. Reachable by the linked
// parent, the school's own admin, or — for the public lookup, which has no
// login — anyone holding the short-lived token that lookup handed out.
export default async function PrintResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ snapshotId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { snapshotId } = await params;
  const { t } = await searchParams;

  const snapshot = await prisma.publishedResultSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot || snapshot.supersededAt) {
    return <Notice title="Result not found">This result doesn&apos;t exist or is no longer current.</Notice>;
  }

  let allowed = verifySnapshotToken(snapshot.id, t);
  if (!allowed) {
    const session = await auth();
    const user = session?.user;
    if (user?.role === "PARENT") {
      allowed = !!(await prisma.parentStudentLink.findFirst({ where: { parentUserId: user.id, studentId: snapshot.studentId } }));
    } else if (user?.role === "SCHOOL_ADMIN") {
      allowed = user.schoolId === snapshot.schoolId;
    }
  }
  if (!allowed) {
    return (
      <Notice title="Link expired or not allowed">
        Open this result from your parent dashboard or the school&apos;s result lookup, then choose Print again.
      </Notice>
    );
  }

  if (!isSnapshotIntact(snapshot)) {
    return <Notice title="Result unavailable">This result failed an automatic integrity check. Please contact your school.</Notice>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/" className="text-caption text-text-muted hover:text-primary">
          &larr; Back
        </Link>
        <PrintButton />
      </div>
      <SnapshotView payload={snapshot.payload as unknown as SnapshotPayload} />
      <p className="mt-3 text-center text-[10px] text-text-muted print:hidden">
        Use your browser&apos;s Print dialog and choose &ldquo;Save as PDF&rdquo; to keep a copy.
      </p>
    </main>
  );
}

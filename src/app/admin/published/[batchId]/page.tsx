import Link from "next/link";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { getAdminAccess } from "@/lib/admin-access";
import { batchWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";

export default async function PublishedBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const access = await getAdminAccess();
  const { schoolId } = access;

  const batch = await prisma.resultBatch.findFirst({ where: { id: batchId, schoolId, ...batchWhere(access), status: "PUBLISHED" }, include: { class: true, template: true } });
  if (!batch) {
    return (
      <>
        <PageHeader eyebrow="School workspace / Published results" title="Published results" intro="This batch isn't published." />
        <EmptyState icon={BadgeCheck} title="Not available" description="It may still be under review, or it no longer exists." />
      </>
    );
  }

  const [results, snapshots] = await Promise.all([
    prisma.result.findMany({ where: { batchId: batch.id, schoolId }, include: { student: true }, orderBy: { student: { firstName: "asc" } } }),
    prisma.publishedResultSnapshot.findMany({ where: { batchId: batch.id, schoolId, supersededAt: null } }),
  ]);
  const current = new Map(snapshots.map((s) => [s.resultId, s]));

  return (
    <>
      <Link href="/admin/published" className="mb-5 inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-primary">
        <ArrowLeft size={15} strokeWidth={1.8} />
        Back to published results
      </Link>
      <PageHeader
        eyebrow="School workspace / Published results"
        title={`${batch.class.name} · ${batch.term}`}
        intro={`${batch.template.name} · ${batch.session}. Correcting a result issues a new version; the earlier one is kept.`}
      />
      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Student", "Version", "Verification code", "Issued", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const snap = current.get(r.id);
                return (
                  <tr key={r.id} className="border-b border-[#f0f2f3] last:border-0">
                    <td className="px-4 py-3.5 pl-5">
                      <strong className="block text-body font-medium text-text-primary">
                        {r.student.firstName} {r.student.lastName}
                      </strong>
                      <span className="text-caption text-text-muted">{r.student.studentCode}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {snap ? <StatusPill label={snap.version > 1 ? `Version ${snap.version} · corrected` : "Version 1"} tone={snap.version > 1 ? "warning" : "neutral"} /> : "—"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-caption text-text-secondary">{snap?.verificationCode ?? "—"}</td>
                    <td className="px-4 py-3.5 text-body text-text-secondary">{snap ? new Date(snap.createdAt).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="px-4 py-3.5 pr-5 text-right">
                      {snap && (
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/result/${snap.id}/print`}
                            target="_blank"
                            className="inline-flex h-8 items-center rounded-md border border-border bg-bg-card px-3 text-caption font-medium text-text-secondary hover:bg-bg-page"
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/published/amend/${r.id}`}
                            className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg"
                          >
                            Correct
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

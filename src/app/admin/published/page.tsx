import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PublishedResultsPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const batches = await prisma.resultBatch.findMany({
    where: { schoolId, status: "PUBLISHED" },
    include: { class: true, template: true, _count: { select: { results: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const corrected = await prisma.publishedResultSnapshot.groupBy({
    by: ["batchId"],
    where: { schoolId, supersededAt: null, version: { gt: 1 }, batchId: { in: batches.map((b) => b.id) } },
    _count: { _all: true },
  });
  const correctedByBatch = new Map(corrected.map((c) => [c.batchId, c._count._all]));

  const intro = "Published results are frozen. To fix a mistake, open the class and issue a correction with a reason — the earlier version is kept.";

  if (batches.length === 0) {
    return (
      <>
        <PageHeader eyebrow="School workspace" title="Published results" intro={intro} />
        <EmptyState icon={BadgeCheck} title="Nothing published yet" description="Batches appear here once you publish them from Results." />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="School workspace" title="Published results" intro={intro} />
      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Class", "Template", "Term", "Published", "Students", "Corrected", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfd]">
                  <td className="px-4 py-4 pl-5 text-body font-medium text-text-primary">{b.class.name}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b.template.name}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">
                    {b.term} · {b.session}
                  </td>
                  <td className="px-4 py-4 text-body text-text-secondary">{new Date(b.updatedAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b._count.results}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{correctedByBatch.get(b.id) ?? 0}</td>
                  <td className="px-4 py-4 pr-5 text-right">
                    <Link
                      href={`/admin/published/${b.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

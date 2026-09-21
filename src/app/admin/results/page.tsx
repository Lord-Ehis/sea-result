import Link from "next/link";
import { FileCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { getAdminAccess } from "@/lib/admin-access";
import { batchWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";

export default async function ResultsPage() {
  const access = await getAdminAccess();
  const { schoolId } = access;

  const batches = await prisma.resultBatch.findMany({
    where: { schoolId, ...batchWhere(access), status: { in: ["SUBMITTED", "APPROVED"] } },
    include: { class: true, template: true, _count: { select: { results: true } } },
    orderBy: { submittedAt: "asc" },
  });
  const teachers = await prisma.user.findMany({
    where: { id: { in: batches.map((b) => b.submittedByUserId).filter((id): id is string => !!id) } },
    select: { id: true, name: true },
  });
  const teacherName = new Map(teachers.map((t) => [t.id, t.name]));

  const rows = batches.map((b) => ({
    batchId: b.id,
    className: b.class.name,
    templateName: b.template.name,
    teacherName: (b.submittedByUserId && teacherName.get(b.submittedByUserId)) || "—",
    submittedAt: b.submittedAt,
    count: b._count.results,
    approved: b.status === "APPROVED",
  }));

  if (rows.length === 0) {
    return (
      <>
        <PageHeader eyebrow="School workspace" title="Results awaiting approval" intro="Review and approve submitted results, then publish them to parents." />
        <EmptyState icon={FileCheck} title="Nothing to review" description="Results submitted by teachers will appear here for approval." />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="School workspace" title="Results awaiting approval" intro="Review and approve submitted results, then publish them to parents." />
      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Class", "Template", "Teacher", "Submitted", "Students", "Stage", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.batchId} className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfd]">
                  <td className="px-4 py-4 pl-5 text-body font-medium text-text-primary">{b.className}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b.templateName}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b.teacherName}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">
                    {b.submittedAt ? new Date(b.submittedAt).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b.count}</td>
                  <td className="px-4 py-4">
                    <StatusPill label={b.approved ? "Approved — ready to publish" : "Awaiting review"} tone={b.approved ? "success" : "warning"} />
                  </td>
                  <td className="px-4 py-4 pr-5 text-right">
                    <Link
                      href={`/admin/results/${b.batchId}`}
                      className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg"
                    >
                      {b.approved ? "Publish" : "Review"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {rows.map((b) => (
            <div key={b.batchId} className="rounded-md border border-border bg-bg-card p-4">
              <strong className="block text-body font-medium text-text-primary">{b.className}</strong>
              <span className="text-caption text-text-muted">{b.templateName}</span>
              <div className="mt-2">
                <StatusPill label={b.approved ? "Approved — ready to publish" : "Awaiting review"} tone={b.approved ? "success" : "warning"} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0f2f3] pt-3 text-caption">
                <div>
                  <dt className="text-[10px] text-text-muted">Teacher</dt>
                  <dd className="text-text-secondary">{b.teacherName}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-text-muted">Submitted</dt>
                  <dd className="text-text-secondary">{b.submittedAt ? new Date(b.submittedAt).toLocaleDateString("en-GB") : "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-text-muted">Students</dt>
                  <dd className="text-text-secondary">{b.count}</dd>
                </div>
              </dl>
              <Link
                href={`/admin/results/${b.batchId}`}
                className="mt-3 flex h-9 w-full items-center justify-center rounded-md border border-[#cbdde9] bg-bg-card text-caption font-medium text-primary hover:bg-primary-bg"
              >
                {b.approved ? "Publish" : "Review"}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

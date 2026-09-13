import Link from "next/link";
import { FileCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ResultsPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const submitted = await prisma.result.findMany({
    where: { schoolId, status: "SUBMITTED" },
    include: { template: { include: { class: true } }, submittedBy: true },
    orderBy: { submittedAt: "asc" },
  });

  const batches = new Map<
    string,
    { templateId: string; className: string; templateName: string; teacherName: string; submittedAt: Date | null; count: number }
  >();
  for (const r of submitted) {
    const key = r.templateId;
    if (!batches.has(key)) {
      batches.set(key, {
        templateId: key,
        className: r.template.class?.name ?? "All classes",
        templateName: r.template.name,
        teacherName: r.submittedBy?.name ?? "—",
        submittedAt: r.submittedAt,
        count: 0,
      });
    }
    batches.get(key)!.count++;
  }
  const rows = Array.from(batches.values());

  if (rows.length === 0) {
    return (
      <>
        <PageHeader eyebrow="School workspace" title="Results awaiting approval" intro="Review submitted results before they're published." />
        <EmptyState icon={FileCheck} title="Nothing to review" description="Results submitted by teachers will appear here for approval." />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="School workspace" title="Results awaiting approval" intro="Review submitted results before they're published." />
      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Class", "Template", "Teacher", "Submitted", "Students", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.templateId} className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfd]">
                  <td className="px-4 py-4 pl-5 text-body font-medium text-text-primary">{b.className}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b.templateName}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b.teacherName}</td>
                  <td className="px-4 py-4 text-body text-text-secondary">
                    {b.submittedAt ? new Date(b.submittedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-4 text-body text-text-secondary">{b.count}</td>
                  <td className="px-4 py-4 pr-5 text-right">
                    <Link
                      href={`/admin/results/${b.templateId}`}
                      className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg"
                    >
                      Review
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

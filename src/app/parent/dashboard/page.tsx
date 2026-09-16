import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParentDashboardClient } from "./ParentDashboardClient";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { buildGridResultData } from "@/lib/grid-compute";

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
      const results = await prisma.result.findMany({
        where: { studentId: student.id, status: "PUBLISHED" },
        include: { template: true },
        orderBy: { publishedAt: "desc" },
      });

      return {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        className: student.class?.name ?? "No class",
        campusName: student.campus.name,
        results: results.map((r) => {
          const templateFields = Array.isArray(r.template.fields) ? (r.template.fields as unknown as TemplateField[]) : [];
          const data = (r.data as Record<string, string>) ?? {};
          return {
            templateId: r.templateId,
            templateName: r.template.name,
            term: r.term,
            publishedAt: r.publishedAt?.toISOString() ?? null,
            // Grid fields have no single data[field.id] value (their cells
            // live under composite keys) — rendered separately via `grids`.
            fields: templateFields
              .filter((f) => f.type !== "Grid")
              .map((f) => ({ name: f.name, value: data[f.id] ?? "—" })),
            grids: buildGridResultData(templateFields, data),
          };
        }),
      };
    }),
  );

  return <ParentDashboardClient students={familyChildren} />;
}

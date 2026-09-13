import { prisma } from "@/lib/prisma";
import { SchoolPicker } from "./SchoolPicker";

// Queries the School table directly; must stay dynamic so newly
// onboarded schools show up without a full production rebuild.
export const dynamic = "force-dynamic";

export default async function ResultLookupPage() {
  const schools = await prisma.school.findMany({
    where: { status: "ACTIVE", allowResultLookup: true },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[420px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-[11px] font-medium text-white">SEA</span>
          <span className="text-subtitle font-medium tracking-tight text-text-primary">Result lookup</span>
        </div>
        <p className="m-0 mb-6 text-body text-text-muted">Find your school to check a student result — no account required.</p>
        <SchoolPicker schools={schools} />
        <p className="mt-6 text-caption text-text-muted">
          Have an account?{" "}
          <a href="/login" className="font-medium text-primary hover:text-primary-hover">
            Sign in instead
          </a>
        </p>
      </div>
    </div>
  );
}

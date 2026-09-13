import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LookupForm } from "./LookupForm";

export default async function SchoolLookupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const school = await prisma.school.findFirst({
    where: { slug, status: "ACTIVE", allowResultLookup: true },
    select: { name: true, slug: true },
  });

  if (!school) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg-page px-4">
        <div className="w-full max-w-[420px] rounded-md border border-border bg-bg-card p-8 text-center">
          <p className="m-0 text-body text-text-secondary">
            We couldn&apos;t find a school at this link, or result lookup isn&apos;t enabled for it.
          </p>
          <Link href="/lookup" className="mt-4 inline-block text-caption font-medium text-primary hover:text-primary-hover">
            Find your school
          </Link>
        </div>
      </div>
    );
  }

  return <LookupForm schoolName={school.name} slug={school.slug} />;
}

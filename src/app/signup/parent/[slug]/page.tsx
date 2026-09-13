import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ParentSignupForm } from "./ParentSignupForm";

export default async function ParentSignupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const school = await prisma.school.findFirst({
    where: { slug, status: "ACTIVE", allowParentAccounts: true },
    select: { name: true, slug: true },
  });

  if (!school) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg-page px-4">
        <div className="w-full max-w-[420px] rounded-md border border-border bg-bg-card p-8 text-center">
          <p className="m-0 text-body text-text-secondary">
            We couldn&apos;t find a school at this link, or parent accounts aren&apos;t enabled for it.
          </p>
          <Link href="/lookup" className="mt-4 inline-block text-caption font-medium text-primary hover:text-primary-hover">
            Look up a result instead
          </Link>
        </div>
      </div>
    );
  }

  return <ParentSignupForm schoolName={school.name} slug={school.slug} />;
}

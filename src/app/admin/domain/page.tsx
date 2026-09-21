import { headers } from "next/headers";
import { requireFullAdminPage } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { DomainClient } from "./DomainClient";

export default async function CustomDomainPage() {
  const { schoolId } = await requireFullAdminPage();
  const school = await prisma.school.findUnique({ where: { id: schoolId } });

  const headerList = await headers();
  const host = headerList.get("host") ?? "sea-result.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const defaultUrl = `${protocol}://${host}/lookup/${school!.slug}`;

  return (
    <DomainClient
      customDomain={school!.customDomain}
      verified={school!.customDomainVerified}
      defaultUrl={defaultUrl}
    />
  );
}

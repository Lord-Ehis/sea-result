import { requireFullAdminPage } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { SchoolProfileClient } from "./SchoolProfileClient";

export default async function SchoolProfilePage() {
  const { schoolId } = await requireFullAdminPage();
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { name: true, logoUrl: true, address: true, phone: true, supportEmail: true },
  });

  return (
    <SchoolProfileClient
      schoolName={school.name}
      logoUrl={school.logoUrl}
      address={school.address}
      phone={school.phone}
      supportEmail={school.supportEmail}
    />
  );
}

import { requireFullAdminPage } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readStudentCodeSettings } from "@/lib/student-code-db";
import { defaultPrefix } from "@/lib/student-code";
import { SchoolProfileClient } from "./SchoolProfileClient";
import { StudentCodeSettings } from "./StudentCodeSettings";

export default async function SchoolProfilePage() {
  const { schoolId } = await requireFullAdminPage();
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: {
      name: true,
      logoUrl: true,
      address: true,
      phone: true,
      supportEmail: true,
      principalName: true,
      principalSignatureUrl: true,
      stampUrl: true,
      nextTermBegins: true,
    },
  });

  const codes = await readStudentCodeSettings(prisma, schoolId);

  return (
    <>
      <SchoolProfileClient
        schoolName={school.name}
        logoUrl={school.logoUrl}
        address={school.address}
        phone={school.phone}
        supportEmail={school.supportEmail}
        principalName={school.principalName}
        principalSignatureUrl={school.principalSignatureUrl}
        stampUrl={school.stampUrl}
        nextTermBegins={school.nextTermBegins ? school.nextTermBegins.toISOString().slice(0, 10) : null}
      />
      <StudentCodeSettings initial={{ ...codes, prefix: codes.prefix || defaultPrefix(school.name) }} />
    </>
  );
}

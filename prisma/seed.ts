import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const school = await prisma.school.upsert({
    where: { slug: "graceland" },
    update: {},
    create: {
      name: "Graceland International School",
      slug: "graceland",
      status: "ACTIVE",
    },
  });

  const campus = await prisma.campus.upsert({
    where: { id: `${school.id}-main-campus` },
    update: {},
    create: {
      id: `${school.id}-main-campus`,
      schoolId: school.id,
      name: "Main campus",
      address: "12 Aba Road, Port Harcourt",
    },
  });

  const klass = await prisma.class.upsert({
    where: { id: `${school.id}-jss1` },
    update: {},
    create: {
      id: `${school.id}-jss1`,
      schoolId: school.id,
      campusId: campus.id,
      name: "JSS 1",
      level: "JSS 1",
      session: "2025/2026",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { email: "admin@gracelandschool.ng" },
    update: {},
    create: {
      schoolId: school.id,
      role: "SCHOOL_ADMIN",
      name: "Nneka Eze",
      email: "admin@gracelandschool.ng",
      passwordHash,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@gracelandschool.ng" },
    update: {},
    create: {
      schoolId: school.id,
      role: "TEACHER",
      name: "Femi Akinola",
      email: "teacher@gracelandschool.ng",
      passwordHash,
    },
  });

  await prisma.teacherClassAssignment.upsert({
    where: { teacherId_classId: { teacherId: teacher.id, classId: klass.id } },
    update: {},
    create: { teacherId: teacher.id, classId: klass.id },
  });

  const students = [
    { studentCode: "GI-2025-001", firstName: "Chidera", lastName: "Nwosu", guardianName: "Ifeoma Nwosu", guardianPhone: "+234 800 000 0101" },
    { studentCode: "GI-2025-014", firstName: "Tobiloba", lastName: "Adeyemi", guardianName: "Kemi Adeyemi", guardianPhone: "+234 800 000 0102" },
  ];

  for (const s of students) {
    await prisma.student.upsert({
      where: { schoolId_studentCode: { schoolId: school.id, studentCode: s.studentCode } },
      update: {},
      create: {
        schoolId: school.id,
        campusId: campus.id,
        classId: klass.id,
        ...s,
      },
    });
  }

  console.log("Seeded:", { school: school.name, campus: campus.name, class: klass.name, students: students.length });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

-- CreateEnum
CREATE TYPE "IncompleteYearPolicy" AS ENUM ('BLOCK', 'CALCULATE_AVAILABLE');

-- CreateEnum
CREATE TYPE "TermExceptionStatus" AS ENUM ('NOT_ENROLLED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PROMOTED', 'RETAINED', 'GRADUATED', 'PENDING', 'NOT_APPLICABLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResultEventAction" ADD VALUE 'TERM_EXCEPTION_SET';
ALTER TYPE "ResultEventAction" ADD VALUE 'TERM_EXCEPTION_CLEARED';

-- AlterTable
ALTER TABLE "result_batches" ADD COLUMN     "termNumber" INTEGER;

-- AlterTable
ALTER TABLE "result_templates" ADD COLUMN     "termNumber" INTEGER;

-- AlterTable
ALTER TABLE "results" ADD COLUMN     "promotedToClassId" TEXT,
ADD COLUMN     "promotionStatus" "PromotionStatus";

-- AlterTable
ALTER TABLE "template_versions" ADD COLUMN     "includeAnnualSummary" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "annual_summary_settings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "term1Weight" DECIMAL(5,2) NOT NULL DEFAULT 33.33,
    "term2Weight" DECIMAL(5,2) NOT NULL DEFAULT 33.33,
    "term3Weight" DECIMAL(5,2) NOT NULL DEFAULT 33.34,
    "incompleteYearPolicy" "IncompleteYearPolicy" NOT NULL DEFAULT 'BLOCK',
    "showAnnualPosition" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annual_summary_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_term_exceptions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "termNumber" INTEGER NOT NULL,
    "status" "TermExceptionStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_term_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annual_summary_settings_schoolId_key" ON "annual_summary_settings"("schoolId");

-- CreateIndex
CREATE INDEX "student_term_exceptions_schoolId_idx" ON "student_term_exceptions"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "student_term_exceptions_studentId_session_termNumber_key" ON "student_term_exceptions"("studentId", "session", "termNumber");

-- AddForeignKey
ALTER TABLE "annual_summary_settings" ADD CONSTRAINT "annual_summary_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_term_exceptions" ADD CONSTRAINT "student_term_exceptions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_term_exceptions" ADD CONSTRAINT "student_term_exceptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

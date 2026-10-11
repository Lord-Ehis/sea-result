-- AlterTable
ALTER TABLE "template_versions" ADD COLUMN     "hiddenStudentDetails" TEXT[] DEFAULT ARRAY[]::TEXT[];

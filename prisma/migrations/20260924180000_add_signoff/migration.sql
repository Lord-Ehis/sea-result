-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "nextTermBegins" TIMESTAMP(3),
ADD COLUMN     "principalName" TEXT,
ADD COLUMN     "principalSignatureUrl" TEXT,
ADD COLUMN     "stampUrl" TEXT;

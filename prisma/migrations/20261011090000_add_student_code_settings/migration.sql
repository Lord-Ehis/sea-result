-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "studentCodeAuto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "studentCodeDigits" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "studentCodeNext" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "studentCodePrefix" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "studentCodeSeparator" TEXT NOT NULL DEFAULT '-',
ADD COLUMN     "studentCodeYear" TEXT NOT NULL DEFAULT 'YYYY';

-- AlterTable
ALTER TABLE "results" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "result_batches" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "term" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "result_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "result_batches_schoolId_idx" ON "result_batches"("schoolId");

-- CreateIndex
CREATE INDEX "result_batches_templateId_idx" ON "result_batches"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "result_batches_classId_templateId_term_session_key" ON "result_batches"("classId", "templateId", "term", "session");

-- CreateIndex
CREATE INDEX "results_batchId_idx" ON "results"("batchId");

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "result_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_batches" ADD CONSTRAINT "result_batches_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_batches" ADD CONSTRAINT "result_batches_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_batches" ADD CONSTRAINT "result_batches_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "result_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

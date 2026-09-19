-- CreateEnum
CREATE TYPE "ResultEventAction" AS ENUM ('SUBMITTED', 'SENT_BACK', 'APPROVED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupeKey" TEXT;

-- CreateTable
CREATE TABLE "published_result_snapshots" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "batchId" TEXT,
    "studentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_result_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "resultId" TEXT,
    "action" "ResultEventAction" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "Role",
    "reason" TEXT,
    "templateVersionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "published_result_snapshots_verificationCode_key" ON "published_result_snapshots"("verificationCode");

-- CreateIndex
CREATE INDEX "published_result_snapshots_schoolId_idx" ON "published_result_snapshots"("schoolId");

-- CreateIndex
CREATE INDEX "published_result_snapshots_studentId_idx" ON "published_result_snapshots"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "published_result_snapshots_resultId_version_key" ON "published_result_snapshots"("resultId", "version");

-- CreateIndex
CREATE INDEX "result_events_schoolId_idx" ON "result_events"("schoolId");

-- CreateIndex
CREATE INDEX "result_events_batchId_idx" ON "result_events"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- AddForeignKey
ALTER TABLE "published_result_snapshots" ADD CONSTRAINT "published_result_snapshots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_result_snapshots" ADD CONSTRAINT "published_result_snapshots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_result_snapshots" ADD CONSTRAINT "published_result_snapshots_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_events" ADD CONSTRAINT "result_events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only audit log: history can be added to, never rewritten.
CREATE FUNCTION result_events_block_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'result_events is append-only: rows cannot be updated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER result_events_no_update
BEFORE UPDATE ON "result_events"
FOR EACH ROW EXECUTE FUNCTION result_events_block_update();

-- Immutable snapshots: everything a parent sees is frozen at publication.
-- Only "supersededAt" (reserved for a future amendment) may change.
CREATE FUNCTION published_result_snapshots_block_change() RETURNS trigger AS $$
BEGIN
  IF NEW."payload" IS DISTINCT FROM OLD."payload"
     OR NEW."checksum" IS DISTINCT FROM OLD."checksum"
     OR NEW."verificationCode" IS DISTINCT FROM OLD."verificationCode"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."resultId" IS DISTINCT FROM OLD."resultId"
     OR NEW."studentId" IS DISTINCT FROM OLD."studentId"
     OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" THEN
    RAISE EXCEPTION 'published_result_snapshots is immutable: a published result cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER published_result_snapshots_immutable
BEFORE UPDATE ON "published_result_snapshots"
FOR EACH ROW EXECUTE FUNCTION published_result_snapshots_block_change();

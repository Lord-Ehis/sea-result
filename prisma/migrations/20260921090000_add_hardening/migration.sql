-- AlterEnum
ALTER TYPE "NotificationEvent" ADD VALUE 'RESULT_AMENDED';

-- AlterEnum
ALTER TYPE "ResultEventAction" ADD VALUE 'AMENDED';

-- AlterTable
ALTER TABLE "published_result_snapshots" ADD COLUMN     "amendedByUserId" TEXT,
ADD COLUMN     "amendmentReason" TEXT,
ADD COLUMN     "supersedesSnapshotId" TEXT;

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE INDEX "rate_limits_windowStart_idx" ON "rate_limits"("windowStart");

-- CreateIndex
CREATE INDEX "result_events_schoolId_createdAt_idx" ON "result_events"("schoolId", "createdAt");

-- Extend snapshot immutability to the amendment columns: who corrected a
-- result, why, and what it replaced can never be rewritten afterwards. Only
-- "supersededAt" may still change (set once when a correction replaces it).
CREATE OR REPLACE FUNCTION published_result_snapshots_block_change() RETURNS trigger AS $$
BEGIN
  IF NEW."payload" IS DISTINCT FROM OLD."payload"
     OR NEW."checksum" IS DISTINCT FROM OLD."checksum"
     OR NEW."verificationCode" IS DISTINCT FROM OLD."verificationCode"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."resultId" IS DISTINCT FROM OLD."resultId"
     OR NEW."studentId" IS DISTINCT FROM OLD."studentId"
     OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
     OR NEW."amendmentReason" IS DISTINCT FROM OLD."amendmentReason"
     OR NEW."amendedByUserId" IS DISTINCT FROM OLD."amendedByUserId"
     OR NEW."supersedesSnapshotId" IS DISTINCT FROM OLD."supersedesSnapshotId" THEN
    RAISE EXCEPTION 'published_result_snapshots is immutable: a published result cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

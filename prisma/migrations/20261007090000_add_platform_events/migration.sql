-- CreateEnum
CREATE TYPE "PlatformEventAction" AS ENUM ('SCHOOL_SUSPENDED', 'SCHOOL_REACTIVATED', 'PROVIDER_CONFIGURED', 'PROVIDER_CLEARED', 'PASSWORD_LINK_SENT');

-- CreateTable
CREATE TABLE "platform_events" (
    "id" TEXT NOT NULL,
    "action" "PlatformEventAction" NOT NULL,
    "actorUserId" TEXT,
    "schoolId" TEXT,
    "targetUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_events_createdAt_idx" ON "platform_events"("createdAt");

-- Lock the Supabase Data API out of the new table (every table gets RLS; see the enable_rls migration).
ALTER TABLE "platform_events" ENABLE ROW LEVEL SECURITY;

-- Append-only: history can be added to, never rewritten.
CREATE FUNCTION platform_events_block_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'platform_events is append-only: rows cannot be updated';
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER platform_events_no_update
BEFORE UPDATE ON "platform_events"
FOR EACH ROW EXECUTE FUNCTION platform_events_block_update();

-- CreateEnum
CREATE TYPE "AccountEventAction" AS ENUM ('EMAIL_CHANGED');

-- CreateTable
CREATE TABLE "account_events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AccountEventAction" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "Role",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_events_schoolId_createdAt_idx" ON "account_events"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "account_events_userId_idx" ON "account_events"("userId");

-- AddForeignKey
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lock the Supabase Data API out of the new table (every table gets RLS; see the enable_rls migration).
ALTER TABLE "account_events" ENABLE ROW LEVEL SECURITY;

-- Append-only: history can be added to, never rewritten.
CREATE FUNCTION account_events_block_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'account_events is append-only: rows cannot be updated';
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER account_events_no_update
BEFORE UPDATE ON "account_events"
FOR EACH ROW EXECUTE FUNCTION account_events_block_update();

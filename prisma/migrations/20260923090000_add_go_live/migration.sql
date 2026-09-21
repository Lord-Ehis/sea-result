-- AlterTable
ALTER TABLE "users" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- CreateTable
CREATE TABLE "system_heartbeats" (
    "key" TEXT NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_heartbeats_pkey" PRIMARY KEY ("key")
);

-- Lock the Supabase Data API out of the new table (every table gets RLS; see the enable_rls migration).
ALTER TABLE "system_heartbeats" ENABLE ROW LEVEL SECURITY;

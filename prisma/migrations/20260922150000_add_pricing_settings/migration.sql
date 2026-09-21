-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "breakdown" JSONB;

-- CreateTable
CREATE TABLE "pricing_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "termPrice" INTEGER NOT NULL,
    "registrationDiscount" INTEGER NOT NULL,
    "sessionDiscountPercent" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_changes" (
    "id" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,

    CONSTRAINT "pricing_changes_pkey" PRIMARY KEY ("id")
);

-- Lock the Supabase Data API out of the new tables (every table gets RLS; see the enable_rls migration).
ALTER TABLE "pricing_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pricing_changes" ENABLE ROW LEVEL SECURITY;

-- Today's prices, so the owner's settings page starts from the live numbers.
INSERT INTO "pricing_settings" ("id", "termPrice", "registrationDiscount", "sessionDiscountPercent", "updatedAt")
VALUES ('default', 50000, 10000, 20, CURRENT_TIMESTAMP);

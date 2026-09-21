-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "billingCycle" "BillingCycle",
ADD COLUMN     "isRegistration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "session" TEXT,
ADD COLUMN     "termNumber" INTEGER;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "creditApplied" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "termNumber" INTEGER;

-- Backfill 1: the term a per-term subscription paid for, read from its label
-- the same way src/lib/term-number.ts does ("1st Term", "First Term", "Term 2, 2026/2027").
-- Labels that can't be read stay NULL — they never block a purchase.
UPDATE "subscriptions"
SET "termNumber" = CASE
  WHEN "term" ~* '\m(first|1st)\M' THEN 1
  WHEN "term" ~* '\m(second|2nd)\M' THEN 2
  WHEN "term" ~* '\m(third|3rd)\M' THEN 3
  WHEN "term" ~* '\mterm\s*1\M' THEN 1
  WHEN "term" ~* '\mterm\s*2\M' THEN 2
  WHEN "term" ~* '\mterm\s*3\M' THEN 3
END
WHERE "billingCycle" = 'PER_TERM' AND "term" IS NOT NULL;

-- Backfill 2: each school's first payment is the one made while registering.
UPDATE "payments"
SET "isRegistration" = true
WHERE "id" IN (SELECT DISTINCT ON ("schoolId") "id" FROM "payments" ORDER BY "schoolId", "createdAt" ASC, "id" ASC);

-- Backfill 3: what each successful payment was for, from the subscription it created.
UPDATE "payments" p
SET "billingCycle" = s."billingCycle", "termNumber" = s."termNumber", "session" = s."session"
FROM "subscriptions" s
WHERE p."subscriptionId" = s."id";

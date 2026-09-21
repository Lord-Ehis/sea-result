-- AlterEnum
ALTER TYPE "NotificationEvent" ADD VALUE 'SUBSCRIPTION_REMINDER';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "isComplimentary" BOOLEAN NOT NULL DEFAULT false;

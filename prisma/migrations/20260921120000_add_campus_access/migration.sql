-- AlterTable
ALTER TABLE "users" ADD COLUMN     "campusScoped" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_campus_access" (
    "userId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_campus_access_pkey" PRIMARY KEY ("userId","campusId")
);

-- CreateIndex
CREATE INDEX "user_campus_access_campusId_idx" ON "user_campus_access"("campusId");

-- AddForeignKey
ALTER TABLE "user_campus_access" ADD CONSTRAINT "user_campus_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_campus_access" ADD CONSTRAINT "user_campus_access_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

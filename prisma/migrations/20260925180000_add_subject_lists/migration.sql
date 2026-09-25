-- CreateTable
CREATE TABLE "subject_lists" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjects" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subject_lists_schoolId_idx" ON "subject_lists"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_lists_schoolId_name_key" ON "subject_lists"("schoolId", "name");

-- AddForeignKey
ALTER TABLE "subject_lists" ADD CONSTRAINT "subject_lists_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lock the Supabase Data API out of this table too (see 20260921180000_enable_rls).
ALTER TABLE "subject_lists" ENABLE ROW LEVEL SECURITY;

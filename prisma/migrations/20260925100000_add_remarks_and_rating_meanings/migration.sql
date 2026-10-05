-- AlterTable
ALTER TABLE "rating_categories" ADD COLUMN     "ratingMeanings" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "template_versions" ADD COLUMN     "includeRemarks" BOOLEAN NOT NULL DEFAULT false;

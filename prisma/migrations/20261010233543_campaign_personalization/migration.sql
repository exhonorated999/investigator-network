-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "customList" JSONB,
ADD COLUMN     "fullHtml" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '';

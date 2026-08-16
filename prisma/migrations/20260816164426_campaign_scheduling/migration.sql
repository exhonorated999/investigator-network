-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

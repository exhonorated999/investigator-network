-- AlterTable
ALTER TABLE "Podcast" ADD COLUMN     "audioUrl" TEXT,
ALTER COLUMN "audioFileId" DROP NOT NULL;

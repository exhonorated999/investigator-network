-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "courseId" TEXT;

-- CreateTable
CREATE TABLE "IspProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IspProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IspProvider_name_idx" ON "IspProvider"("name");

-- CreateIndex
CREATE INDEX "Campaign_courseId_idx" ON "Campaign"("courseId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;


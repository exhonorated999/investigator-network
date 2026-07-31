-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenCourseId" TEXT,
ADD COLUMN     "lastSeenPath" TEXT,
ADD COLUMN     "lastSeenUnitId" TEXT;

-- CreateIndex
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastSeenCourseId_fkey" FOREIGN KEY ("lastSeenCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

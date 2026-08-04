-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "instructor" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "trainingHours" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "CourseActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CourseActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseActivity_courseId_day_idx" ON "CourseActivity"("courseId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CourseActivity_userId_courseId_day_key" ON "CourseActivity"("userId", "courseId", "day");

-- AddForeignKey
ALTER TABLE "CourseActivity" ADD CONSTRAINT "CourseActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseActivity" ADD CONSTRAINT "CourseActivity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

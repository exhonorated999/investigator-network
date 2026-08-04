-- CreateEnum
CREATE TYPE "Pricing" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "pricing" "Pricing" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "CourseQuestion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "staff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseQuestion_courseId_resolved_createdAt_idx" ON "CourseQuestion"("courseId", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "CourseQuestion_authorId_idx" ON "CourseQuestion"("authorId");

-- CreateIndex
CREATE INDEX "CourseAnswer_questionId_createdAt_idx" ON "CourseAnswer"("questionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseQuestion" ADD CONSTRAINT "CourseQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseQuestion" ADD CONSTRAINT "CourseQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAnswer" ADD CONSTRAINT "CourseAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CourseQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAnswer" ADD CONSTRAINT "CourseAnswer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

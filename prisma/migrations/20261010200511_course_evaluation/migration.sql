-- CreateTable
CREATE TABLE "CourseEvaluation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "testimonialOk" BOOLEAN NOT NULL DEFAULT false,
    "testimonial" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEvaluation_courseId_createdAt_idx" ON "CourseEvaluation"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEvaluation_userId_courseId_key" ON "CourseEvaluation"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "CourseEvaluation" ADD CONSTRAINT "CourseEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEvaluation" ADD CONSTRAINT "CourseEvaluation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

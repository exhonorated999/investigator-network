-- CreateTable
CREATE TABLE "QuizDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizDraft_quizId_idx" ON "QuizDraft"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizDraft_userId_quizId_key" ON "QuizDraft"("userId", "quizId");

-- AddForeignKey
ALTER TABLE "QuizDraft" ADD CONSTRAINT "QuizDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizDraft" ADD CONSTRAINT "QuizDraft_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

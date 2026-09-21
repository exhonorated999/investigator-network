-- CreateEnum
CREATE TYPE "GrantCategory" AS ENUM ('INVESTIGATIONS', 'DFIR', 'SO_SYMPOSIUM');

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "grantingAgency" TEXT NOT NULL DEFAULT '',
    "qualifyingAgency" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3),
    "categories" "GrantCategory"[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Grant_published_idx" ON "Grant"("published");

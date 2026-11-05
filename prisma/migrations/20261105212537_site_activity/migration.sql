-- CreateTable
CREATE TABLE "SiteActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteActivity_day_idx" ON "SiteActivity"("day");

-- CreateIndex
CREATE UNIQUE INDEX "SiteActivity_userId_day_key" ON "SiteActivity"("userId", "day");

-- AddForeignKey
ALTER TABLE "SiteActivity" ADD CONSTRAINT "SiteActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

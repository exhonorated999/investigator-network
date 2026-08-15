-- CreateTable
CREATE TABLE "PartnerClick" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "userId" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerClick_partnerId_clickedAt_idx" ON "PartnerClick"("partnerId", "clickedAt");

-- CreateIndex
CREATE INDEX "PartnerClick_clickedAt_idx" ON "PartnerClick"("clickedAt");

-- AddForeignKey
ALTER TABLE "PartnerClick" ADD CONSTRAINT "PartnerClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

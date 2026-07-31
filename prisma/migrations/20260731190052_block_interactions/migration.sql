-- CreateTable
CREATE TABLE "BlockInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockInteraction_unitId_blockId_idx" ON "BlockInteraction"("unitId", "blockId");

-- CreateIndex
CREATE INDEX "BlockInteraction_userId_unitId_idx" ON "BlockInteraction"("userId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockInteraction_userId_unitId_blockId_key" ON "BlockInteraction"("userId", "unitId", "blockId");

-- AddForeignKey
ALTER TABLE "BlockInteraction" ADD CONSTRAINT "BlockInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockInteraction" ADD CONSTRAINT "BlockInteraction_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

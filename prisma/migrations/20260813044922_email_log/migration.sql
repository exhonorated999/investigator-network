-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_kind_unitId_idx" ON "EmailLog"("kind", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_kind_unitId_userId_key" ON "EmailLog"("kind", "unitId", "userId");

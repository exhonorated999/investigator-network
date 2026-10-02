-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "viperRequestedAt" TIMESTAMP(3),
ADD COLUMN     "viperShippedAt" TIMESTAMP(3),
ADD COLUMN     "viperTracking" TEXT;

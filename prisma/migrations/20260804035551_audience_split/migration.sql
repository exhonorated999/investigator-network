-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('LE', 'CIVILIAN');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "audiences" "Audience"[] DEFAULT ARRAY['LE']::"Audience"[],
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "audience" "Audience" NOT NULL DEFAULT 'LE',
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '';

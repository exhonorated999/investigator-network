-- Onboarding: activation links + legacy migration provenance.
--
-- Also back-fills the `isSuperAdmin` column into migration history: it was
-- applied directly to the database earlier, which left the schema drifted.
-- Guarded with IF NOT EXISTS so this is safe on both drifted and clean
-- databases.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- A migrated / admin-created account has no usable password until the user
-- redeems an activation link and sets one.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Provenance for accounts pulled off the legacy LearnWorlds site.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_legacyId_key" ON "User"("legacyId");

DO $$ BEGIN
  CREATE TYPE "InviteTokenPurpose" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InviteToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "InviteTokenPurpose" NOT NULL DEFAULT 'ACTIVATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "issuedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "InviteToken_userId_idx" ON "InviteToken"("userId");
CREATE INDEX IF NOT EXISTS "InviteToken_expiresAt_idx" ON "InviteToken"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "InviteToken"
    ADD CONSTRAINT "InviteToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

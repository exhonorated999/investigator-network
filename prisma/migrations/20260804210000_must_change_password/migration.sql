-- Bootstrap-password onboarding: flag accounts whose current password is a
-- temporary credential they did not choose, so every authenticated area can
-- force them through /change-password.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

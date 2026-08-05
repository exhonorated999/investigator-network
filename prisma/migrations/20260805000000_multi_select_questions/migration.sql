-- Multi-select support for quiz questions.
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "multiSelect" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "selectedChoiceIds" JSONB;

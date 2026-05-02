-- Add fields for abandoned conversation recovery follow-ups
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "phoneFollowupSentAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "intentFollowupSentAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "isReturningCustomer" BOOLEAN NOT NULL DEFAULT false;

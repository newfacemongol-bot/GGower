-- Add morningConfirmedAt column to Conversation for night-order morning confirmations.
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "morningConfirmedAt" TIMESTAMP(3);

-- Add sentiment column to Conversation for negative-message tracking
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "sentiment" TEXT NOT NULL DEFAULT 'neutral';
CREATE INDEX IF NOT EXISTS "Conversation_sentiment_idx" ON "Conversation" ("sentiment");

-- Add archive flags to Conversation and CommentLead
-- Records are never deleted; archived after 30 days of inactivity.

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "CommentLead"
  ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Conversation_isArchived_lastMessageAt_idx"
  ON "Conversation" ("isArchived", "lastMessageAt" DESC);

CREATE INDEX IF NOT EXISTS "CommentLead_isArchived_queuedAt_idx"
  ON "CommentLead" ("isArchived", "queuedAt" DESC);

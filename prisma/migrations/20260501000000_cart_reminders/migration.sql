-- Conversation extensions: reminders, handoff, misunderstand, history
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "abandonedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "reminder1SentAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "reminder23SentAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "handoffReason" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "misunderstandCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "Conversation_abandonedAt_idx" ON "Conversation"("abandonedAt");

-- Order extensions: retry
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lastRetryAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

CREATE INDEX IF NOT EXISTS "Order_status_retryCount_idx" ON "Order"("status", "retryCount");

-- ReplyTemplate
CREATE TABLE IF NOT EXISTS "ReplyTemplate" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "shortcut" TEXT,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ReplyTemplate_isActive_idx" ON "ReplyTemplate"("isActive");

-- AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT,
  "meta" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- SpamBlock
CREATE TABLE IF NOT EXISTS "SpamBlock" (
  "id" TEXT PRIMARY KEY,
  "psid" TEXT UNIQUE NOT NULL,
  "pageId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SpamBlock_pageId_idx" ON "SpamBlock"("pageId");

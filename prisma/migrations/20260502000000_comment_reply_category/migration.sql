-- Add category column to CommentReply for pattern-based replies
ALTER TABLE "CommentReply" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'generic';

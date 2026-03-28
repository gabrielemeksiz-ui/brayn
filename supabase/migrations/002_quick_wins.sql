-- supabase/migrations/002_quick_wins.sql

-- QW5: Remove unused translation column
ALTER TABLE notes DROP COLUMN IF EXISTS clean_other_language;

-- QW3: Add AI processing status
ALTER TABLE notes ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'done';

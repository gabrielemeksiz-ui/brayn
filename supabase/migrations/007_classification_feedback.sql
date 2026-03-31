-- Add ai_categories column to notes (snapshot of AI prediction)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS ai_categories text[] DEFAULT '{}';

-- Classification feedback table
CREATE TABLE IF NOT EXISTS classification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  ai_categories TEXT[] NOT NULL DEFAULT '{}',
  user_categories TEXT[] NOT NULL DEFAULT '{}',
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correction', 'implicit_validation', 'explicit_validation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT classification_feedback_note_id_key UNIQUE (note_id)
);

-- RLS
ALTER TABLE classification_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own feedback"
  ON classification_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedback"
  ON classification_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own feedback"
  ON classification_feedback FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access on classification_feedback"
  ON classification_feedback FOR ALL
  USING (auth.role() = 'service_role');

-- Index for few-shot queries (recent feedback by user)
CREATE INDEX idx_classification_feedback_user_recent
  ON classification_feedback (user_id, created_at DESC);

-- Index for category-based lookups
CREATE INDEX idx_classification_feedback_user_type
  ON classification_feedback (user_id, feedback_type, created_at DESC);

-- Upsert RPC function (never downgrade correction to validation)
CREATE OR REPLACE FUNCTION upsert_classification_feedback(
  p_note_id UUID,
  p_user_id UUID,
  p_original_text TEXT,
  p_ai_categories TEXT[],
  p_user_categories TEXT[],
  p_feedback_type TEXT
) RETURNS VOID AS $$
DECLARE
  existing_type TEXT;
BEGIN
  SELECT feedback_type INTO existing_type
  FROM classification_feedback
  WHERE note_id = p_note_id;

  IF existing_type IS NULL THEN
    INSERT INTO classification_feedback (note_id, user_id, original_text, ai_categories, user_categories, feedback_type)
    VALUES (p_note_id, p_user_id, p_original_text, p_ai_categories, p_user_categories, p_feedback_type);
  ELSIF existing_type = 'correction' AND p_feedback_type != 'correction' THEN
    NULL;
  ELSE
    UPDATE classification_feedback
    SET user_categories = p_user_categories,
        feedback_type = p_feedback_type,
        created_at = now()
    WHERE note_id = p_note_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

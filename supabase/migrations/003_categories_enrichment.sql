-- ============================================
-- Migration: Enrichissement catégories + Onboarding
-- ============================================

-- 1. Nouvelles colonnes sur categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '📌';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6B7280';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS ai_description TEXT DEFAULT '';

-- 2. Onboarding flag sur user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 3. Table de templates de catégories (profils d'onboarding)
CREATE TABLE IF NOT EXISTS category_templates (
  id TEXT PRIMARY KEY,
  profile_label TEXT NOT NULL,
  profile_emoji TEXT DEFAULT '👤',
  interests TEXT[] DEFAULT '{}',
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pas de RLS sur category_templates : lecture publique, écriture admin uniquement
ALTER TABLE category_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates"
  ON category_templates FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage templates"
  ON category_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- 4. Fonction SQL pour retirer une catégorie de toutes les notes d'un user
CREATE OR REPLACE FUNCTION remove_category_from_notes(category_id TEXT, p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notes
  SET categories = array_remove(categories, category_id)
  WHERE user_id = p_user_id
  AND category_id = ANY(categories);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

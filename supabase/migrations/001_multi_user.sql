-- ============================================
-- Migration: Multi-utilisateur Brayn
-- ============================================

-- 1. Nouvelles tables
-- -------------------

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invitation_codes (
  code TEXT PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id),
  used_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  max_uses INT DEFAULT 1,
  use_count INT DEFAULT 0
);

CREATE TABLE telegram_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false
);

-- 2. Modifier tables existantes
-- -----------------------------

-- Ajouter user_id aux notes (nullable pour migration progressive)
ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Ajouter user_id aux categories
ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Contrainte unique : un user ne peut pas avoir 2 categories avec le meme id/slug
ALTER TABLE categories ADD CONSTRAINT categories_user_id_id_unique UNIQUE (user_id, id);

-- 3. Row Level Security
-- ---------------------

-- notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own notes"
  ON notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (user_id = auth.uid());

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  USING (user_id = auth.uid());

-- note_chats (via note parente)
ALTER TABLE note_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chats of their notes"
  ON note_chats FOR SELECT
  USING (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_chats.note_id AND notes.user_id = auth.uid()));

CREATE POLICY "Users can insert chats on their notes"
  ON note_chats FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_chats.note_id AND notes.user_id = auth.uid()));

CREATE POLICY "Users can delete chats of their notes"
  ON note_chats FOR DELETE
  USING (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_chats.note_id AND notes.user_id = auth.uid()));

-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

-- telegram_users
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own telegram link"
  ON telegram_users FOR SELECT
  USING (user_id = auth.uid());

-- telegram_link_codes
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own link codes"
  ON telegram_link_codes FOR ALL
  USING (user_id = auth.uid());

-- invitation_codes : lecture publique pour validation au signup
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can check invitation codes"
  ON invitation_codes FOR SELECT
  USING (true);

-- 4. Migration des donnees (a executer apres creation du user admin)
-- ------------------------------------------------------------------
-- Ces requetes sont dans un bloc commenté. Decommenter et executer
-- apres avoir cree le premier user admin via Supabase Auth.
--
-- UPDATE notes SET user_id = '<ADMIN_USER_UUID>';
-- UPDATE categories SET user_id = '<ADMIN_USER_UUID>';
-- ALTER TABLE notes ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
-- INSERT INTO user_profiles (user_id, is_admin) VALUES ('<ADMIN_USER_UUID>', true);

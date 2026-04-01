-- ============================================================
-- 008: Full-text search (tsvector) + Semantic embeddings (pgvector)
-- ============================================================

-- 1. Full-text search
-- Add a generated tsvector column combining all searchable text fields
ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(original_text, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(clean_original_language, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(full_text, '')), 'C')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_notes_search_vector ON notes USING GIN (search_vector);

-- Search function with ranking and highlights
CREATE OR REPLACE FUNCTION search_notes(
  search_query text,
  p_user_id uuid,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  source text,
  seen boolean,
  categories text[],
  ai_categories text[],
  tags text[],
  links text[],
  original_text text,
  clean_original_language text,
  full_text text,
  user_id uuid,
  ai_status text,
  rank real,
  headline_original text,
  headline_clean text
) LANGUAGE sql STABLE AS $$
  SELECT
    n.id, n.created_at, n.updated_at, n.source, n.seen,
    n.categories, n.ai_categories, n.tags, n.links,
    n.original_text, n.clean_original_language, n.full_text,
    n.user_id, n.ai_status,
    ts_rank(n.search_vector, websearch_to_tsquery('french', search_query)) AS rank,
    ts_headline('french', coalesce(n.original_text, ''), websearch_to_tsquery('french', search_query),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS headline_original,
    ts_headline('french', coalesce(n.clean_original_language, ''), websearch_to_tsquery('french', search_query),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS headline_clean
  FROM notes n
  WHERE n.user_id = p_user_id
    AND n.search_vector @@ websearch_to_tsquery('french', search_query)
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

-- 2. Semantic embeddings with pgvector
-- Enable the extension (Supabase has it available)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (1024 dimensions — will adjust if needed based on model)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_notes_embedding ON notes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function to find related notes by cosine similarity
CREATE OR REPLACE FUNCTION find_related_notes(
  p_note_id uuid,
  p_user_id uuid,
  p_limit int DEFAULT 10,
  p_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  original_text text,
  clean_original_language text,
  categories text[],
  created_at timestamptz,
  similarity float
) LANGUAGE sql STABLE AS $$
  SELECT
    n.id, n.original_text, n.clean_original_language,
    n.categories, n.created_at,
    1 - (n.embedding <=> (SELECT embedding FROM notes WHERE notes.id = p_note_id)) AS similarity
  FROM notes n
  WHERE n.user_id = p_user_id
    AND n.id != p_note_id
    AND n.embedding IS NOT NULL
    AND (SELECT embedding FROM notes WHERE notes.id = p_note_id) IS NOT NULL
    AND 1 - (n.embedding <=> (SELECT embedding FROM notes WHERE notes.id = p_note_id)) > p_threshold
  ORDER BY n.embedding <=> (SELECT embedding FROM notes WHERE notes.id = p_note_id)
  LIMIT p_limit;
$$;

-- Function to get all notes with embeddings for graph view
CREATE OR REPLACE FUNCTION get_graph_data(p_user_id uuid, p_similarity_threshold float DEFAULT 0.4)
RETURNS TABLE (
  source_id uuid,
  target_id uuid,
  similarity float
) LANGUAGE sql STABLE AS $$
  SELECT
    a.id AS source_id,
    b.id AS target_id,
    1 - (a.embedding <=> b.embedding) AS similarity
  FROM notes a
  CROSS JOIN notes b
  WHERE a.user_id = p_user_id
    AND b.user_id = p_user_id
    AND a.id < b.id
    AND a.embedding IS NOT NULL
    AND b.embedding IS NOT NULL
    AND 1 - (a.embedding <=> b.embedding) > p_similarity_threshold
  ORDER BY similarity DESC
  LIMIT 500;
$$;

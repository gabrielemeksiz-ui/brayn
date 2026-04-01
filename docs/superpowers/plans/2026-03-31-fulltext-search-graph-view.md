# Full-Text Search + Notes Liées (Graph View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostgreSQL full-text search with ranking/highlighting, and a semantic graph view connecting notes via pgvector embeddings + shared categories.

**Architecture:** Two independent subsystems sharing one migration. Full-text search uses `tsvector` with a GIN index and `ts_rank`/`ts_headline` for ranked results with highlights. Graph view uses `pgvector` for cosine similarity between note embeddings generated at ingestion time via Groq embeddings API. The graph UI uses `react-force-graph-2d` for interactive visualization. A new `/api/notes/[id]/related` endpoint returns similar notes. A `/api/graph` endpoint returns all nodes+edges for the graph view.

**Tech Stack:** PostgreSQL tsvector + GIN index, pgvector extension, Groq embeddings API, react-force-graph-2d, Next.js API routes

---

## File Structure

### New Files
- `supabase/migrations/008_fulltext_search_and_embeddings.sql` — Migration: tsvector column, GIN index, pgvector extension, embedding column, search function
- `src/lib/embeddings.ts` — Embedding generation via Groq API
- `src/app/api/notes/search/route.ts` — Full-text search endpoint with ranking + highlights
- `src/app/api/notes/[id]/related/route.ts` — Related notes via cosine similarity
- `src/app/api/graph/route.ts` — Graph data endpoint (nodes + edges)
- `src/components/GraphView.tsx` — Interactive force-directed graph component
- `src/app/api/notes/backfill-embeddings/route.ts` — One-time backfill for existing notes

### Modified Files
- `src/lib/types.ts` — Add SearchResult, GraphNode, GraphEdge types
- `src/app/api/notes/ingest/route.ts` — Generate embedding at ingestion time
- `src/app/api/notes/route.ts` — Redirect search queries to new search endpoint (or keep simple for non-search)
- `src/app/page.tsx` — Integrate search results with highlights, add Graph View section in sidebar
- `src/components/NoteList.tsx` — Support highlighted search results display
- `package.json` — Add react-force-graph-2d dependency

---

## Task 1: Database Migration — tsvector + pgvector

**Files:**
- Create: `supabase/migrations/008_fulltext_search_and_embeddings.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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

-- Add embedding column (1024 dimensions for Groq/llama embeddings)
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
  HAVING 1 - (n.embedding <=> (SELECT embedding FROM notes WHERE notes.id = p_note_id)) > p_threshold
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
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with name `fulltext_search_and_embeddings` and the SQL above.

- [ ] **Step 3: Verify the migration**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'notes' AND column_name IN ('search_vector', 'embedding');
```
Expected: two rows — `search_vector` (tsvector) and `embedding` (USER-DEFINED / vector).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_fulltext_search_and_embeddings.sql
git commit -m "feat: add tsvector full-text search + pgvector embeddings migration"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add new types to types.ts**

Add the following types at the end of `src/lib/types.ts`:

```typescript
export interface SearchResult extends Note {
  rank: number;
  headline_original: string;
  headline_clean: string;
}

export interface RelatedNote {
  id: string;
  original_text: string;
  clean_original_language: string | null;
  categories: string[];
  created_at: string;
  similarity: number;
}

export interface GraphNode {
  id: string;
  original_text: string;
  clean_original_language: string | null;
  categories: string[];
  created_at: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add SearchResult, RelatedNote, and Graph types"
```

---

## Task 3: Embedding Generation Module

**Files:**
- Create: `src/lib/embeddings.ts`

- [ ] **Step 1: Create the embeddings module**

```typescript
import OpenAI from 'openai';

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.slice(0, 8000);
  const response = await getClient().embeddings.create({
    model: 'llama-3.3-70b-versatile',
    input,
  });
  return response.data[0].embedding;
}

export function buildEmbeddingText(note: {
  original_text: string | null;
  clean_original_language?: string | null;
  full_text?: string | null;
}): string {
  const parts = [
    note.original_text ?? '',
    note.clean_original_language ?? '',
    note.full_text ?? '',
  ].filter(Boolean);
  return parts.join('\n').slice(0, 8000);
}
```

**Important note:** Groq may not support embeddings with `llama-3.3-70b-versatile`. If Groq doesn't have an embedding endpoint, we'll need to use an alternative. Check the Groq docs during implementation. Alternatives:
- Use `nomic-embed-text` model on Groq if available
- Use Supabase's built-in `pg_net` + external embedding API
- Use a free embedding API like Jina or Voyage

The engineer implementing this should test `generateEmbedding("test")` and if it fails, swap the model. Update the model name and potentially the vector dimension in the migration (e.g., 768 for nomic-embed-text instead of 1024).

- [ ] **Step 2: Commit**

```bash
git add src/lib/embeddings.ts
git commit -m "feat: add embedding generation module"
```

---

## Task 4: Full-Text Search API Endpoint

**Files:**
- Create: `src/app/api/notes/search/route.ts`

- [ ] **Step 1: Create the search endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    if (!q || !q.trim()) {
      return NextResponse.json([], { status: 200 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

    const { data, error } = await supabase.rpc('search_notes', {
      search_query: q,
      p_user_id: user.id,
      p_limit: limit,
    });

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/notes/search:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the endpoint works**

Start dev server and test:
```bash
curl "http://localhost:3000/api/notes/search?q=test"
```
Expected: JSON array (may be empty if no notes match, but no 500 error).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notes/search/route.ts
git commit -m "feat: add full-text search API with ranking and highlights"
```

---

## Task 5: Integrate Embeddings into Ingestion Pipeline

**Files:**
- Modify: `src/app/api/notes/ingest/route.ts`

- [ ] **Step 1: Add embedding generation after AI processing**

At the top of `ingest/route.ts`, add the import:
```typescript
import { generateEmbedding, buildEmbeddingText } from '@/lib/embeddings';
```

In **Flow B** (existing desktop note classification), after the AI classification/rewrite results are applied to `updates`, add before the final `.update()`:

```typescript
// Generate embedding (non-blocking — don't fail the whole ingestion)
try {
  const embeddingText = buildEmbeddingText({
    original_text: text,
    clean_original_language: updates.clean_original_language as string | null,
    full_text: existingNote.full_text as string | null,
  });
  if (embeddingText.trim()) {
    const embedding = await generateEmbedding(embeddingText);
    updates.embedding = JSON.stringify(embedding);
  }
} catch (embErr) {
  console.error('Embedding generation failed (non-blocking):', embErr);
}
```

In **Flow A** (new note from Telegram/YouTube), add the same block before the final `.update()`, using the available text fields:

```typescript
try {
  const embeddingText = buildEmbeddingText({
    original_text: text,
    clean_original_language: updates.clean_original_language as string | null,
    full_text: tweetFullText ?? null,
  });
  if (embeddingText.trim()) {
    const embedding = await generateEmbedding(embeddingText);
    updates.embedding = JSON.stringify(embedding);
  }
} catch (embErr) {
  console.error('Embedding generation failed (non-blocking):', embErr);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/notes/ingest/route.ts
git commit -m "feat: generate embeddings during note ingestion"
```

---

## Task 6: Related Notes API Endpoint

**Files:**
- Create: `src/app/api/notes/[id]/related/route.ts`

- [ ] **Step 1: Create the related notes endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: noteId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 30);

    const { data, error } = await supabase.rpc('find_related_notes', {
      p_note_id: noteId,
      p_user_id: user.id,
      p_limit: limit,
      p_threshold: 0.3,
    });

    if (error) {
      console.error('Related notes error:', error);
      return NextResponse.json({ error: 'Failed to find related notes' }, { status: 500 });
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/notes/[id]/related:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/notes/[id]/related/route.ts
git commit -m "feat: add related notes API endpoint using cosine similarity"
```

---

## Task 7: Graph Data API Endpoint

**Files:**
- Create: `src/app/api/graph/route.ts`

- [ ] **Step 1: Create the graph endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const threshold = parseFloat(searchParams.get('threshold') ?? '0.4');

    // Get edges from similarity function
    const { data: edges, error: edgesError } = await supabase.rpc('get_graph_data', {
      p_user_id: user.id,
      p_similarity_threshold: threshold,
    });

    if (edgesError) {
      console.error('Graph edges error:', edgesError);
      return NextResponse.json({ error: 'Failed to get graph data' }, { status: 500 });
    }

    // Get all notes with embeddings for nodes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, original_text, clean_original_language, categories, created_at')
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Graph nodes error:', notesError);
      return NextResponse.json({ error: 'Failed to get graph nodes' }, { status: 500 });
    }

    // Also add edges for notes sharing 2+ categories
    const categoryEdges: { source_id: string; target_id: string; similarity: number }[] = [];
    const notesArr = notes ?? [];
    for (let i = 0; i < notesArr.length; i++) {
      for (let j = i + 1; j < notesArr.length; j++) {
        const shared = (notesArr[i].categories ?? []).filter(
          (c: string) => (notesArr[j].categories ?? []).includes(c)
        );
        if (shared.length >= 2) {
          // Check if this edge already exists from semantic similarity
          const alreadyExists = (edges ?? []).some(
            (e: { source_id: string; target_id: string }) =>
              (e.source_id === notesArr[i].id && e.target_id === notesArr[j].id) ||
              (e.source_id === notesArr[j].id && e.target_id === notesArr[i].id)
          );
          if (!alreadyExists) {
            categoryEdges.push({
              source_id: notesArr[i].id,
              target_id: notesArr[j].id,
              similarity: 0.2 + shared.length * 0.1, // Weak link weight
            });
          }
        }
      }
    }

    return NextResponse.json({
      nodes: notesArr.map(n => ({
        id: n.id,
        original_text: n.original_text,
        clean_original_language: n.clean_original_language,
        categories: n.categories,
        created_at: n.created_at,
      })),
      edges: [
        ...(edges ?? []).map((e: { source_id: string; target_id: string; similarity: number }) => ({
          source: e.source_id,
          target: e.target_id,
          similarity: e.similarity,
        })),
        ...categoryEdges.map(e => ({
          source: e.source_id,
          target: e.target_id,
          similarity: e.similarity,
        })),
      ],
    }, { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/graph:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/graph/route.ts
git commit -m "feat: add graph data API with semantic + category edges"
```

---

## Task 8: Backfill Embeddings for Existing Notes

**Files:**
- Create: `src/app/api/notes/backfill-embeddings/route.ts`

- [ ] **Step 1: Create the backfill endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { generateEmbedding, buildEmbeddingText } from '@/lib/embeddings';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // Simple auth check: require admin or cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all notes without embeddings
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, original_text, clean_original_language, full_text')
      .is('embedding', null)
      .order('created_at', { ascending: false })
      .limit(50); // Process in batches of 50

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let processed = 0;
    let failed = 0;

    for (const note of notes ?? []) {
      try {
        const text = buildEmbeddingText(note);
        if (!text.trim()) continue;

        const embedding = await generateEmbedding(text);
        await supabase
          .from('notes')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', note.id);
        processed++;
      } catch (err) {
        console.error(`Failed to embed note ${note.id}:`, err);
        failed++;
      }
    }

    const remaining = (notes?.length ?? 0) - processed - failed;
    return NextResponse.json({
      ok: true,
      processed,
      failed,
      total: notes?.length ?? 0,
      message: remaining > 0 ? 'Run again to process more notes' : 'All notes in this batch processed',
    });
  } catch (err) {
    console.error('Error in POST /api/notes/backfill-embeddings:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/notes/backfill-embeddings/route.ts
git commit -m "feat: add embeddings backfill endpoint for existing notes"
```

---

## Task 9: Install react-force-graph-2d

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm install react-force-graph-2d
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-force-graph-2d dependency"
```

---

## Task 10: Graph View Component

**Files:**
- Create: `src/components/GraphView.tsx`

- [ ] **Step 1: Create the graph component**

```tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphData, GraphNode } from '@/lib/types';

// Dynamic import to avoid SSR issues
import dynamic from 'next/dynamic';
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphViewProps {
  getCatColor: (cat: string) => string;
  getCatLabel: (cat: string) => string;
  onSelectNote: (noteId: string) => void;
}

export function GraphView({ getCatColor, getCatLabel, onSelectNote }: GraphViewProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [threshold, setThreshold] = useState(0.4);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/graph?threshold=${threshold}`);
      const data: GraphData = await res.json();
      setGraphData(data);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    }
    setLoading(false);
  }, [threshold]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[#e4e2e4]/30">Chargement du graphe...</p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3">
        <span className="material-symbols-outlined text-[48px] text-[#e4e2e4]/15">hub</span>
        <p className="text-sm text-[#e4e2e4]/30">Aucune note avec embedding</p>
        <p className="text-xs text-[#e4e2e4]/20">Les embeddings sont generees automatiquement a l&apos;ingestion</p>
      </div>
    );
  }

  const nodeTitle = (node: GraphNode) =>
    (node.clean_original_language ?? node.original_text ?? '').slice(0, 60);

  const primaryColor = (node: GraphNode) => {
    const firstCat = (node.categories ?? [])[0];
    return firstCat ? getCatColor(firstCat) : '#6B7280';
  };

  const forceGraphData = {
    nodes: graphData.nodes.map(n => ({ ...n, name: nodeTitle(n) })),
    links: graphData.edges.map(e => ({
      source: e.source,
      target: e.target,
      value: e.similarity,
    })),
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
      {/* Controls */}
      <div className="px-6 py-3 flex items-center gap-4 shrink-0 border-b border-[#2a2a2c]">
        <span className="text-xs text-[#e4e2e4]/40">
          {graphData.nodes.length} notes &middot; {graphData.edges.length} liens
        </span>
        <label className="flex items-center gap-2 text-xs text-[#e4e2e4]/40">
          Seuil:
          <input
            type="range"
            min="0.2"
            max="0.8"
            step="0.05"
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="w-24 accent-[#ffcbd0]"
          />
          <span className="text-[#ffcbd0] font-mono w-8">{threshold.toFixed(2)}</span>
        </label>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute z-50 bg-[#1f1f21] border border-[#534344]/30 rounded-xl p-3 max-w-xs shadow-lg pointer-events-none"
          style={{ top: 80, right: 20 }}>
          <p className="text-sm text-[#e4e2e4] font-medium mb-1">{nodeTitle(hoveredNode)}</p>
          <div className="flex gap-1 flex-wrap">
            {(hoveredNode.categories ?? []).map(cat => (
              <span key={cat} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ backgroundColor: getCatColor(cat) + '20', color: getCatColor(cat) }}>
                {getCatLabel(cat)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Graph */}
      <div className="flex-1">
        <ForceGraph2D
          graphData={forceGraphData}
          width={containerRef.current?.clientWidth ?? 800}
          height={(containerRef.current?.clientHeight ?? 600) - 50}
          backgroundColor="#131315"
          nodeColor={(node: Record<string, unknown>) => primaryColor(node as unknown as GraphNode)}
          nodeRelSize={6}
          nodeLabel={(node: Record<string, unknown>) => (node as unknown as GraphNode & { name: string }).name}
          linkColor={() => 'rgba(255,203,208,0.15)'}
          linkWidth={(link: Record<string, unknown>) => ((link as { value: number }).value ?? 0.3) * 3}
          onNodeClick={(node: Record<string, unknown>) => onSelectNote((node as { id: string }).id)}
          onNodeHover={(node: Record<string, unknown> | null) => setHoveredNode(node as unknown as GraphNode | null)}
          cooldownTicks={100}
          nodeCanvasObject={(node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const typedNode = node as unknown as GraphNode & { x: number; y: number; name: string };
            const label = typedNode.name;
            const fontSize = 11 / globalScale;
            const nodeR = 5;
            const color = primaryColor(typedNode);

            // Node circle
            ctx.beginPath();
            ctx.arc(typedNode.x, typedNode.y, nodeR, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // Label (only if zoomed in enough)
            if (globalScale > 0.8) {
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = '#e4e2e4';
              ctx.fillText(label.slice(0, 30), typedNode.x, typedNode.y + nodeR + 2);
            }
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GraphView.tsx
git commit -m "feat: add interactive graph view component with force-directed layout"
```

---

## Task 11: Integrate Search Results with Highlights in UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/NoteList.tsx`

- [ ] **Step 1: Update page.tsx search logic**

In `src/app/page.tsx`, modify the `fetchNotes` function to use the search endpoint when `search` is non-empty:

Replace the existing `fetchNotes` callback (around line 96-118) with:

```typescript
const fetchNotes = useCallback(async () => {
  setLoading(true);

  // Use dedicated search endpoint for full-text queries
  if (search.trim()) {
    try {
      const res = await fetch(`/api/notes/search?q=${encodeURIComponent(search)}&limit=50`);
      const data = await res.json();
      setNotes(data);
    } catch {
      setNotes([]);
    }
    setLoading(false);
    return;
  }

  const params = new URLSearchParams();

  if (section === 'new') params.set('seen', 'false');
  if (section === 'recent')
    params.set('from', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  if (section !== 'new' && section !== 'all' && section !== 'recent' && section !== 'settings' && section !== 'graph') {
    params.set('category', section);
  }
  if (filterCat) params.set('category', filterCat);
  if (filterPeriod === 'today') params.set('from', new Date().toISOString().split('T')[0]);
  if (filterPeriod === '7d')
    params.set('from', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  if (filterPeriod === '30d')
    params.set('from', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);

  const res = await fetch(`/api/notes?${params}`);
  const data = await res.json();
  setNotes(data);
  setLoading(false);
}, [section, search, filterCat, filterPeriod]);
```

- [ ] **Step 2: Add debouncing for search input**

In `src/app/page.tsx`, add a debounced search state. After the existing state declarations (around line 37):

```typescript
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(search), 300);
  return () => clearTimeout(timer);
}, [search]);
```

Then update the `fetchNotes` dependency array to use `debouncedSearch` instead of `search`, and update the condition inside `fetchNotes` to check `debouncedSearch.trim()` instead of `search.trim()`.

- [ ] **Step 3: Update NoteList to support highlighted results**

In `src/components/NoteList.tsx`, update the `NoteListProps` interface and the rendering to show highlights when available:

Add to the imports at top:
```typescript
import type { Note, SearchResult } from '@/lib/types';
```

Update the `noteSnippet` function to handle highlights:

```typescript
function noteSnippet(note: Note | SearchResult): string {
  // If search result with highlights, use them
  if ('headline_clean' in note && note.headline_clean) {
    return note.headline_clean;
  }
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  const isTweet =
    note.links?.some(l => tweetRegex.test(l)) ||
    tweetRegex.test(note.original_text ?? '');
  if (isTweet) return '';
  return note.clean_original_language ?? '';
}
```

In the snippet rendering (around line 134), replace the plain text with HTML that supports `<mark>` tags:

```tsx
{snippet && (
  <p
    className="text-sm text-[#d8c1c3] line-clamp-1 mb-3 [&>mark]:bg-[#ffcbd0]/30 [&>mark]:text-[#ffcbd0] [&>mark]:rounded-sm [&>mark]:px-0.5"
    dangerouslySetInnerHTML={{ __html: snippet }}
  />
)}
```

Also update `noteTitle` to support highlighted original text:
```typescript
function noteTitle(note: Note | SearchResult): string {
  if ('headline_original' in note && note.headline_original) {
    return note.headline_original;
  }
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  const isTweet =
    note.links?.some(l => tweetRegex.test(l)) ||
    tweetRegex.test(note.original_text ?? '');
  if (isTweet) return note.clean_original_language ?? note.original_text ?? '';
  return note.original_text ?? '';
}
```

Update the title rendering to use `dangerouslySetInnerHTML`:
```tsx
<p
  className="text-lg font-semibold text-[#e4e2e4] truncate group-hover:text-[#ffcbd0] transition-colors duration-150 [&>mark]:bg-[#ffcbd0]/30 [&>mark]:text-[#ffcbd0] [&>mark]:rounded-sm [&>mark]:px-0.5"
  dangerouslySetInnerHTML={{ __html: noteTitle(note) }}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/NoteList.tsx
git commit -m "feat: integrate full-text search with ranking and highlighted results"
```

---

## Task 12: Add Graph View to Sidebar + Main Content

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import GraphView component**

At the top of `page.tsx`, add:
```typescript
import { GraphView } from '@/components/GraphView';
```

- [ ] **Step 2: Add "Graph" section to sidebar navigation**

After the `{sidebarNavItem('Tous', 'all', 'docs')}` line (around line 412), add:

```tsx
{sidebarNavItem('Graphe', 'graph', 'hub')}
```

- [ ] **Step 3: Add Graph View rendering in main content area**

In the main content rendering section (around line 656-685), update the conditional rendering to include the graph view. Before the `section === 'settings'` check, add the graph section:

```tsx
{section === 'graph' ? (
  <GraphView
    getCatColor={getCatColor}
    getCatLabel={getCatLabel}
    onSelectNote={(noteId) => {
      const note = allNotes.find(n => n.id === noteId);
      if (note) {
        setSection('all');
        openNote(note);
      }
    }}
  />
) : section === 'settings' ? (
```

- [ ] **Step 4: Update Section type to include 'graph'**

In the Section type definition (around line 27):
```typescript
type Section = 'new' | 'all' | 'recent' | 'graph' | string;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add graph view section in sidebar and main content"
```

---

## Task 13: Related Notes Panel in NoteDetail

**Files:**
- Modify: `src/components/NoteDetail.tsx`

- [ ] **Step 1: Add related notes section to NoteDetail**

In `src/components/NoteDetail.tsx`, add a related notes section. After the existing imports, add:

```typescript
import type { RelatedNote } from '@/lib/types';
```

Inside the `NoteDetail` component, add state and fetch for related notes:

```typescript
const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([]);
const [relatedLoading, setRelatedLoading] = useState(false);

useEffect(() => {
  let cancelled = false;
  setRelatedLoading(true);
  fetch(`/api/notes/${note.id}/related?limit=5`)
    .then(r => r.json())
    .then(data => {
      if (!cancelled && Array.isArray(data)) setRelatedNotes(data);
    })
    .catch(() => {})
    .finally(() => { if (!cancelled) setRelatedLoading(false); });
  return () => { cancelled = true; };
}, [note.id]);
```

Add the related notes UI after the existing note content (before the chat section). Find a suitable location in the JSX and add:

```tsx
{/* Notes liees */}
{relatedNotes.length > 0 && (
  <div className="mt-6 pt-4 border-t border-[#2a2a2c]">
    <p className="text-[10px] uppercase tracking-widest text-[#e4e2e4]/30 font-bold mb-3 flex items-center gap-2">
      <span className="material-symbols-outlined text-[14px]">hub</span>
      Notes liees
    </p>
    <div className="space-y-1.5">
      {relatedNotes.map(rn => (
        <button
          key={rn.id}
          onClick={() => {
            // Navigate to the related note
            onNoteUpdated({ ...note }); // Keep current note state
            // The parent will handle navigation
            window.dispatchEvent(new CustomEvent('brayn:open-note', { detail: { noteId: rn.id } }));
          }}
          className="w-full text-left px-3 py-2 rounded-lg bg-[#1b1b1d] hover:bg-[#353437]/50 transition-colors group"
        >
          <p className="text-sm text-[#e4e2e4]/80 group-hover:text-[#ffcbd0] truncate transition-colors">
            {rn.clean_original_language ?? rn.original_text}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-[#e4e2e4]/30 font-mono">
              {Math.round(rn.similarity * 100)}% similaire
            </span>
            {(rn.categories ?? []).slice(0, 2).map(cat => (
              <span key={cat} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ backgroundColor: getCatColor(cat) + '20', color: getCatColor(cat) }}>
                {getCatLabel(cat)}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  </div>
)}
```

**Alternative to CustomEvent:** Instead of using `window.dispatchEvent`, pass an `onOpenRelated` callback from the parent. Add to `NoteDetailProps`:

```typescript
onOpenRelated?: (noteId: string) => void;
```

And use it in the button click handler:
```typescript
onClick={() => onOpenRelated?.(rn.id)}
```

In `page.tsx`, pass the prop:
```tsx
onOpenRelated={(noteId) => {
  const rn = allNotes.find(n => n.id === noteId);
  if (rn) openNote(rn);
}}
```

Use the callback approach, NOT the CustomEvent approach.

- [ ] **Step 2: Commit**

```bash
git add src/components/NoteDetail.tsx src/app/page.tsx
git commit -m "feat: show related notes panel in note detail view"
```

---

## Task 14: Run Backfill + End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm run dev
```

- [ ] **Step 2: Test the embedding generation**

Check that the Groq embedding model works:
```bash
curl -X POST http://localhost:3000/api/notes/backfill-embeddings \
  -H "Authorization: Bearer $CRON_SECRET"
```

If the model doesn't support embeddings, switch to an alternative (see Task 3 notes) and re-run.

- [ ] **Step 3: Test full-text search**

Open the app, type a query in the search bar. Verify:
- Results appear with highlighted matches
- Results are ranked by relevance
- Empty query returns to normal listing

- [ ] **Step 4: Test graph view**

Click "Graphe" in the sidebar. Verify:
- Nodes appear with category colors
- Edges connect similar notes
- Clicking a node opens the note
- Threshold slider adjusts edge density
- Hover shows tooltip with note title and categories

- [ ] **Step 5: Test related notes**

Open any note. Verify:
- "Notes liees" section appears if related notes exist
- Similarity percentage is shown
- Clicking a related note navigates to it

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end verification fixes for search and graph view"
```

---

## Notes & Risks

1. **Groq Embedding Model**: Groq may not support embedding generation with llama-3.3-70b-versatile. If not, alternatives:
   - Use `nomic-embed-text-v1.5` (768 dimensions) — update migration to `vector(768)`
   - Use OpenAI `text-embedding-3-small` (1536 dimensions) — requires separate API key
   - Use Jina AI free embedding API

2. **ivfflat index**: Requires at least ~100 rows to be effective. For small datasets, the index won't help much but won't hurt either. Consider switching to HNSW index later for better performance.

3. **Graph performance**: The `get_graph_data` function does a cross-join which is O(n^2). For >1000 notes, consider adding pagination or pre-computing edges.

4. **dangerouslySetInnerHTML**: The search highlights use HTML from PostgreSQL's `ts_headline`. This is safe because the HTML is generated server-side with controlled `StartSel`/`StopSel` markers, not from user input. The `<mark>` tags are the only HTML injected.

5. **Migration ivfflat lists parameter**: Set to 100 which works well for up to ~100k vectors. Adjust if the dataset grows significantly.

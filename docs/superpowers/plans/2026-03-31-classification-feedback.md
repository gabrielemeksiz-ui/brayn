# Classification Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the AI classifier to learn from user corrections and validations via few-shot examples injected at classification time, with a suggestion system for improving category descriptions.

**Architecture:** New `classification_feedback` table stores user signals (correction, implicit/explicit validation). `classifyNote()` fetches relevant feedback and injects few-shot examples into the prompt. A new validate-classification endpoint + UI button complete the loop. A suggestions endpoint analyzes error patterns.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js Route Handlers, React, Groq/LLama 3.3

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/007_classification_feedback.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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

-- Service role bypass (for ingest route which uses service client)
CREATE POLICY "Service role full access on classification_feedback"
  ON classification_feedback FOR ALL
  USING (auth.role() = 'service_role');

-- Index for few-shot queries (recent feedback by user)
CREATE INDEX idx_classification_feedback_user_recent
  ON classification_feedback (user_id, created_at DESC);

-- Index for category-based lookups
CREATE INDEX idx_classification_feedback_user_type
  ON classification_feedback (user_id, feedback_type, created_at DESC);
```

- [ ] **Step 2: Apply the migration**

Run via Supabase MCP tool `apply_migration` or:
```bash
# If using Supabase CLI
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_classification_feedback.sql
git commit -m "feat: add classification_feedback table and ai_categories column"
```

---

### Task 2: Update Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add feedback types to types.ts**

Add at the end of `src/lib/types.ts`:

```typescript
export type FeedbackType = 'correction' | 'implicit_validation' | 'explicit_validation';

export interface ClassificationFeedback {
  id: string;
  note_id: string;
  user_id: string;
  original_text: string;
  ai_categories: string[];
  user_categories: string[];
  feedback_type: FeedbackType;
  created_at: string;
}
```

Also add `ai_categories` to the `Note` interface:

```typescript
// In the Note interface, add:
ai_categories: string[];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ClassificationFeedback type and ai_categories to Note"
```

---

### Task 3: Save `ai_categories` During Ingestion

**Files:**
- Modify: `src/app/api/notes/ingest/route.ts`

- [ ] **Step 1: In Flow B (classify existing note), save ai_categories alongside categories**

In the section around line 49 where `classifyResult` is checked, also save `ai_categories`:

```typescript
if (classifyResult.status === 'fulfilled') {
  updates.categories = classifyResult.value.categories;
  updates.ai_categories = classifyResult.value.categories;
}
```

- [ ] **Step 2: In Flow A (create + classify new note), same change**

In the section around line 167 where categories are set:

```typescript
if (classifyResult.status === 'fulfilled') {
  const cats = classifyResult.value.categories as string[];
  if (tweetUrlMatch && !cats.includes('twitter')) cats.unshift('twitter');
  updates.categories = cats;
  updates.ai_categories = [...cats];
} else if (tweetUrlMatch) {
  updates.categories = ['twitter'];
  updates.ai_categories = ['twitter'];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notes/ingest/route.ts
git commit -m "feat: save ai_categories snapshot during note ingestion"
```

---

### Task 4: Feedback Capture on Category Correction (Signal A)

**Files:**
- Modify: `src/app/api/notes/[id]/route.ts`

- [ ] **Step 1: Add feedback upsert logic to PATCH handler**

After the successful `supabase.from("notes").update(updates)` call (line 42-53), add feedback detection when `categories` was in the update:

```typescript
// After the existing update + select block, before the return:

if ('categories' in updates && data) {
  const aiCats = (data.ai_categories as string[]) ?? [];
  const userCats = (updates.categories as string[]) ?? [];
  const arraysEqual = aiCats.length === userCats.length && aiCats.every((c, i) => c === userCats[i]);
  
  // Determine feedback type
  const feedbackType = arraysEqual ? 'explicit_validation' : 'correction';
  
  // Upsert feedback — never downgrade correction to validation
  await supabase.rpc('upsert_classification_feedback', {
    p_note_id: id,
    p_user_id: user.id,
    p_original_text: (data.original_text as string) ?? '',
    p_ai_categories: aiCats,
    p_user_categories: userCats,
    p_feedback_type: feedbackType,
  });
}
```

- [ ] **Step 2: Create the upsert RPC function in a new migration**

Create `supabase/migrations/008_feedback_upsert_rpc.sql`:

```sql
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
  -- Check existing feedback type
  SELECT feedback_type INTO existing_type
  FROM classification_feedback
  WHERE note_id = p_note_id;

  IF existing_type IS NULL THEN
    -- No existing feedback, insert
    INSERT INTO classification_feedback (note_id, user_id, original_text, ai_categories, user_categories, feedback_type)
    VALUES (p_note_id, p_user_id, p_original_text, p_ai_categories, p_user_categories, p_feedback_type);
  ELSIF existing_type = 'correction' AND p_feedback_type != 'correction' THEN
    -- Never downgrade correction to validation — skip
    NULL;
  ELSE
    -- Update
    UPDATE classification_feedback
    SET user_categories = p_user_categories,
        feedback_type = p_feedback_type,
        created_at = now()
    WHERE note_id = p_note_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 3: Apply migration and commit**

```bash
git add supabase/migrations/008_feedback_upsert_rpc.sql src/app/api/notes/[id]/route.ts
git commit -m "feat: capture classification feedback on category correction"
```

---

### Task 5: Implicit Validation on Seen (Signal B)

**Files:**
- Modify: `src/app/api/notes/[id]/route.ts`

- [ ] **Step 1: Add implicit validation logic when seen is set to true**

In the same PATCH handler, after the existing update block, add:

```typescript
if ('seen' in updates && updates.seen === true && data) {
  const aiCats = (data.ai_categories as string[]) ?? [];
  // Only insert implicit validation if no feedback exists yet and note was AI-classified
  if (aiCats.length > 0) {
    await supabase.rpc('upsert_classification_feedback', {
      p_note_id: id,
      p_user_id: user.id,
      p_original_text: (data.original_text as string) ?? '',
      p_ai_categories: aiCats,
      p_user_categories: aiCats,
      p_feedback_type: 'implicit_validation',
    });
  }
}
```

The RPC function from Task 4 already handles the "never downgrade" logic, so if a correction or explicit validation already exists, implicit_validation is ignored.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/notes/[id]/route.ts
git commit -m "feat: capture implicit validation feedback when note marked as seen"
```

---

### Task 6: Explicit Validation Endpoint (Signal C)

**Files:**
- Create: `src/app/api/notes/[id]/validate-classification/route.ts`

- [ ] **Step 1: Create the validate-classification route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing note id' }, { status: 400 });

  const { data: note, error: fetchError } = await supabase
    .from('notes')
    .select('original_text, categories, ai_categories')
    .eq('id', id)
    .single();

  if (fetchError || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const aiCats = (note.ai_categories as string[]) ?? [];
  if (aiCats.length === 0) {
    return NextResponse.json({ error: 'Note has no AI classification to validate' }, { status: 400 });
  }

  await supabase.rpc('upsert_classification_feedback', {
    p_note_id: id,
    p_user_id: user.id,
    p_original_text: (note.original_text as string) ?? '',
    p_ai_categories: aiCats,
    p_user_categories: (note.categories as string[]) ?? [],
    p_feedback_type: 'explicit_validation',
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/notes/[id]/validate-classification/route.ts
git commit -m "feat: add POST validate-classification endpoint for explicit feedback"
```

---

### Task 7: Few-Shot Dynamic Injection in `classifyNote()`

**Files:**
- Modify: `src/lib/ai.ts`
- Create: `src/lib/feedback.ts`

- [ ] **Step 1: Create feedback fetching utility**

Create `src/lib/feedback.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface FeedbackExample {
  original_text: string;
  ai_categories: string[];
  user_categories: string[];
  feedback_type: string;
}

export async function getFewShotExamples(
  supabase: SupabaseClient,
  userId: string,
): Promise<FeedbackExample[]> {
  // 1. Fetch 3 most recent corrections/explicit validations
  const { data: recent } = await supabase
    .from('classification_feedback')
    .select('original_text, ai_categories, user_categories, feedback_type')
    .eq('user_id', userId)
    .in('feedback_type', ['correction', 'explicit_validation'])
    .order('created_at', { ascending: false })
    .limit(3);

  // 2. Find top corrected categories (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: corrections } = await supabase
    .from('classification_feedback')
    .select('ai_categories, user_categories')
    .eq('user_id', userId)
    .eq('feedback_type', 'correction')
    .gte('created_at', thirtyDaysAgo);

  // Count which categories are most often wrong
  const catErrorCount: Record<string, number> = {};
  for (const fb of corrections ?? []) {
    for (const cat of (fb.ai_categories as string[]) ?? []) {
      if (!(fb.user_categories as string[])?.includes(cat)) {
        catErrorCount[cat] = (catErrorCount[cat] ?? 0) + 1;
      }
    }
    for (const cat of (fb.user_categories as string[]) ?? []) {
      if (!(fb.ai_categories as string[])?.includes(cat)) {
        catErrorCount[cat] = (catErrorCount[cat] ?? 0) + 1;
      }
    }
  }

  const topErrorCats = Object.entries(catErrorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // 3. Fetch 3 corrections involving those categories
  let categoryExamples: FeedbackExample[] = [];
  if (topErrorCats.length > 0) {
    const { data: catFeedback } = await supabase
      .from('classification_feedback')
      .select('original_text, ai_categories, user_categories, feedback_type')
      .eq('user_id', userId)
      .eq('feedback_type', 'correction')
      .or(
        topErrorCats.map(c => `ai_categories.cs.{${c}},user_categories.cs.{${c}}`).join(',')
      )
      .order('created_at', { ascending: false })
      .limit(3);

    categoryExamples = catFeedback ?? [];
  }

  // 4. Merge, deduplicate by note content, limit to 5
  const seen = new Set<string>();
  const result: FeedbackExample[] = [];

  for (const fb of [...(recent ?? []), ...categoryExamples]) {
    const key = fb.original_text.slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(fb);
    if (result.length >= 5) break;
  }

  return result;
}

export function formatFewShotBlock(examples: FeedbackExample[]): string {
  if (examples.length === 0) return '';

  const lines = examples.map(ex => {
    const text = ex.original_text.length > 100
      ? ex.original_text.slice(0, 100) + '…'
      : ex.original_text;
    const userCats = `[${ex.user_categories.join(', ')}]`;

    if (ex.feedback_type === 'correction') {
      const aiCats = `[${ex.ai_categories.join(', ')}]`;
      return `- "${text}" → ${userCats} (corrigé, l'IA avait mis ${aiCats})`;
    }
    return `- "${text}" → ${userCats} (validé par l'utilisateur)`;
  });

  return `\nExemples de classements corrigés/validés par l'utilisateur (utilise-les pour calibrer ton jugement) :\n\n${lines.join('\n')}\n`;
}
```

- [ ] **Step 2: Update classifyNote() to accept and inject feedback**

Modify `src/lib/ai.ts`. Change the `classifyNote` signature to accept an optional feedback block:

```typescript
export async function classifyNote(
  originalText: string,
  allCategories: { id: string; label: string; ai_description: string }[],
  fewShotBlock?: string,
): Promise<AIClassificationResponse> {
```

In the prompt, insert `fewShotBlock` between the rules and the note:

```typescript
content: `Tu es le classificateur IA de Brayn, app de prise de notes intelligente. Analyse la note et assigne 1 à 3 catégories parmi la liste stricte ci-dessous. Ne crée JAMAIS de nouvelles catégories.

Catégories autorisées (strictement celles-ci, jamais en créer de nouvelles) :
${categoryList}

Règles :
1. Cherche d'abord L'INTENTION FINALE de la note : quel est le vrai message, la conclusion, la préoccupation centrale ?
2. Ne te laisse pas piéger par les mots-clés de surface. Les sujets mentionnés en passant ne sont pas forcément la catégorie
3. Demande-toi : "pourquoi l'auteur a écrit cette note ? qu'est-ce qu'il veut retenir ?"
4. Assigne 1 catégorie si l'intention est claire. 2-3 seulement si la note exprime vraiment plusieurs intentions distinctes
${fewShotBlock ?? ''}
Note à classer :
${originalText}

SORTIE JSON STRICT (rien d'autre) :
{"categories": ["cat1", "cat2"], "confiance": 10, "explication": "1 phrase"}`,
```

- [ ] **Step 3: Update ingest route to pass feedback to classifyNote()**

In `src/app/api/notes/ingest/route.ts`, import and use the feedback functions.

For **Flow B** (classify existing note), after loading categories (around line 34):

```typescript
import { getFewShotExamples, formatFewShotBlock } from '@/lib/feedback';

// After loading categories, before the Promise.allSettled:
const feedbackExamples = await getFewShotExamples(supabase, userId);
const fewShotBlock = formatFewShotBlock(feedbackExamples);

// Update the classifyNote call:
classifyNote(text, customCategories, fewShotBlock),
```

Same for **Flow A** (around line 158):

```typescript
const feedbackExamples = await getFewShotExamples(supabase, userId);
const fewShotBlock = formatFewShotBlock(feedbackExamples);

const [classifyResult, rewriteResult] = await Promise.allSettled([
  classifyNote(tweetTitle ?? text, customCategories, fewShotBlock),
  tweetTitle
    ? Promise.resolve({ clean_original_language: tweetTitle })
    : rewriteNote(text),
]);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/feedback.ts src/lib/ai.ts src/app/api/notes/ingest/route.ts
git commit -m "feat: inject few-shot feedback examples into AI classification prompt"
```

---

### Task 8: UI — Validate Classification Button

**Files:**
- Modify: `src/components/NoteDetail.tsx`

- [ ] **Step 1: Add state and handler for validation button**

Add state inside the `NoteDetail` component (after the existing `useState` declarations around line 64):

```typescript
const [feedbackStatus, setFeedbackStatus] = useState<'none' | 'validated' | 'corrected' | 'loading'>('none');
```

Add an effect to fetch feedback status when note changes (after the existing useEffect blocks):

```typescript
useEffect(() => {
  if (!note.ai_categories || note.ai_categories.length === 0) {
    setFeedbackStatus('none');
    return;
  }
  fetch(`/api/notes/${note.id}/validate-classification`)
    .then(r => {
      if (r.status === 404) return null;
      return r.json();
    })
    .then(data => {
      if (!data) { setFeedbackStatus('none'); return; }
      if (data.feedback_type === 'correction') setFeedbackStatus('corrected');
      else if (data.feedback_type === 'explicit_validation') setFeedbackStatus('validated');
      else setFeedbackStatus('none');
    })
    .catch(() => setFeedbackStatus('none'));
}, [note.id, note.ai_categories]);
```

Add the handler:

```typescript
const handleValidateClassification = async () => {
  setFeedbackStatus('loading');
  try {
    await fetch(`/api/notes/${note.id}/validate-classification`, {
      method: 'POST',
    });
    setFeedbackStatus('validated');
  } catch {
    setFeedbackStatus('none');
  }
};
```

- [ ] **Step 2: Add GET handler to validate-classification route for fetching status**

Modify `src/app/api/notes/[id]/validate-classification/route.ts` to add a GET:

```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data } = await supabase
    .from('classification_feedback')
    .select('feedback_type')
    .eq('note_id', id)
    .single();

  if (!data) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(data);
}
```

- [ ] **Step 3: Render the button in NoteDetail**

After the category badges `</select>` closing tag (line 280), before the closing `</div>` of the categories wrapper:

```tsx
{/* Validate classification button */}
{note.ai_categories && note.ai_categories.length > 0 && (
  feedbackStatus === 'corrected' ? (
    <span className="flex items-center gap-1 text-[10px] text-amber-400/60 uppercase tracking-wider ml-2">
      <span className="material-symbols-outlined" style={{fontSize: '14px'}}>edit</span>
      Classement corrigé
    </span>
  ) : feedbackStatus === 'validated' ? (
    <span className="flex items-center gap-1 text-[10px] text-green-400/60 uppercase tracking-wider ml-2">
      <span className="material-symbols-outlined" style={{fontSize: '14px', fontVariationSettings: "'FILL' 1"}}>check_circle</span>
      Classement validé
    </span>
  ) : (
    <button
      onClick={handleValidateClassification}
      disabled={feedbackStatus === 'loading'}
      className="flex items-center gap-1 text-[10px] text-[#666] hover:text-green-400 uppercase tracking-wider ml-2 transition-colors duration-100 disabled:opacity-40"
      title="Valider le classement IA"
    >
      <span className="material-symbols-outlined" style={{fontSize: '14px'}}>check_circle</span>
      Bon classement
    </button>
  )
)}
```

- [ ] **Step 4: Update feedbackStatus when user corrects categories**

In the existing `updateNoteCategories` function, after the PATCH call, update feedback status:

```typescript
const updateNoteCategories = async (newCategories: NoteCategory[]) => {
  const updated = { ...note, categories: newCategories };
  onNoteUpdated(updated);
  await fetch(`/api/notes/${note.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: newCategories }),
  });
  // Update feedback status if AI classified this note
  if (note.ai_categories && note.ai_categories.length > 0) {
    const arraysEqual = note.ai_categories.length === newCategories.length
      && note.ai_categories.every((c, i) => c === newCategories[i]);
    setFeedbackStatus(arraysEqual ? 'validated' : 'corrected');
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add src/components/NoteDetail.tsx src/app/api/notes/[id]/validate-classification/route.ts
git commit -m "feat: add validate classification button in note detail UI"
```

---

### Task 9: Category Suggestions Endpoint

**Files:**
- Create: `src/app/api/categories/suggestions/route.ts`

- [ ] **Step 1: Create the suggestions route**

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';
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

interface CategorySuggestion {
  category_id: string;
  current_description: string;
  suggested_description: string;
  reason: string;
  stats: { corrections: number; total: number; error_rate: number };
}

export async function GET() {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all feedback for this user in last 30 days
  const { data: feedbacks } = await supabase
    .from('classification_feedback')
    .select('ai_categories, user_categories, feedback_type, original_text')
    .eq('user_id', user.id)
    .gte('created_at', thirtyDaysAgo);

  if (!feedbacks || feedbacks.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch user's categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, label, ai_description')
    .eq('hidden', false);

  if (!categories) return NextResponse.json([]);

  // Compute per-category error stats
  const catStats: Record<string, { corrections: number; total: number; examples: string[] }> = {};

  for (const fb of feedbacks) {
    const aiCats = (fb.ai_categories as string[]) ?? [];
    const userCats = (fb.user_categories as string[]) ?? [];
    const allCats = [...new Set([...aiCats, ...userCats])];

    for (const cat of allCats) {
      if (!catStats[cat]) catStats[cat] = { corrections: 0, total: 0, examples: [] };
      catStats[cat].total++;

      const isCorrection = fb.feedback_type === 'correction';
      const catInvolved = (aiCats.includes(cat) && !userCats.includes(cat))
        || (!aiCats.includes(cat) && userCats.includes(cat));

      if (isCorrection && catInvolved) {
        catStats[cat].corrections++;
        if (catStats[cat].examples.length < 3) {
          const dir = aiCats.includes(cat) ? 'faux positif' : 'faux négatif';
          catStats[cat].examples.push(
            `"${(fb.original_text as string).slice(0, 80)}" (${dir}, IA: [${aiCats.join(',')}] → user: [${userCats.join(',')}])`
          );
        }
      }
    }
  }

  // Generate suggestions for categories with >30% error rate
  const suggestions: CategorySuggestion[] = [];

  for (const cat of categories) {
    const stats = catStats[cat.id];
    if (!stats || stats.total < 3) continue;

    const errorRate = stats.corrections / stats.total;
    if (errorRate <= 0.3) continue;

    // Ask AI to suggest improved description
    const response = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `La catégorie "${cat.label}" (description actuelle pour l'IA : "${cat.ai_description || 'aucune'}") a un taux d'erreur de ${Math.round(errorRate * 100)}% dans le classificateur IA.

Exemples d'erreurs :
${stats.examples.join('\n')}

Propose une description améliorée (1-2 phrases) pour aider l'IA à mieux identifier cette catégorie. La description doit clarifier ce qui APPARTIENT à cette catégorie et ce qui N'Y APPARTIENT PAS.

Réponds uniquement avec un JSON : {"description": "...", "reason": "..."}`,
      }],
    });

    try {
      const text = response.choices[0]?.message?.content ?? '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as { description: string; reason: string };

      suggestions.push({
        category_id: cat.id,
        current_description: cat.ai_description || '',
        suggested_description: parsed.description,
        reason: parsed.reason,
        stats: {
          corrections: stats.corrections,
          total: stats.total,
          error_rate: Math.round(errorRate * 100) / 100,
        },
      });
    } catch {
      // Skip if AI response unparseable
    }
  }

  return NextResponse.json(suggestions);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/categories/suggestions/route.ts
git commit -m "feat: add category suggestions endpoint based on feedback analysis"
```

---

### Task 10: Final Integration Verification

- [ ] **Step 1: Verify build passes**

```bash
npm run build
```

Fix any TypeScript errors.

- [ ] **Step 2: Manual smoke test**

1. Create a note via desktop → check `ai_categories` is populated in DB
2. Modify categories on a note → check `classification_feedback` row created with `feedback_type = 'correction'`
3. Mark a note as seen → check implicit validation created
4. Click "Bon classement" button → check explicit validation created
5. Create another note → verify the classification prompt includes few-shot examples

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for classification feedback system"
```

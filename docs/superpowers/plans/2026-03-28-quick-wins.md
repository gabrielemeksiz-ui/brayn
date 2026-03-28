# Quick Wins Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 quick wins: DB cleanup (QW5), ai_status column (QW3-DB), Supabase Realtime (QW4), note list in main panel (QW1), and desktop AI ingestion + status banner (QW2+QW3-UI).

**Architecture:** DB migration first, then infrastructure (Realtime hook), then UI extraction (NoteList/NoteDetail components split from page.tsx), then AI features on top. No external testing infrastructure exists — use `npm run build` as the verification gate after each task.

**Tech Stack:** Next.js 14 App Router, React 19, TypeScript, Supabase (PostgreSQL + Realtime), Tailwind CSS 4, `@supabase/ssr`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/002_quick_wins.sql` | Create | Drop `clean_other_language`, add `ai_status` |
| `src/lib/types.ts` | Modify | Remove `clean_other_language`, add `ai_status` |
| `src/app/api/notes/[id]/route.ts` | Modify | Remove `clean_other_language` from ALLOWED_FIELDS |
| `src/app/api/notes/[id]/chat/route.ts` | Modify | Remove `clean_other_language` from select |
| `src/app/api/notes/route.ts` | Modify | Remove `clean_original_language` fallback insert; set `ai_status = 'pending'` for desktop |
| `src/app/api/notes/ingest/route.ts` | Modify | Accept `note_id` for existing notes; set `ai_status` through lifecycle |
| `src/lib/hooks/useRealtimeNotes.ts` | Create | Supabase Realtime subscription hook |
| `src/components/NoteList.tsx` | Create | List of compact note cards, select mode, bulk delete |
| `src/components/NoteDetail.tsx` | Create | Full note detail extracted from page.tsx |
| `src/app/page.tsx` | Modify | Remove polling, use Realtime, use NoteList/NoteDetail |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/002_quick_wins.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/002_quick_wins.sql

-- QW5: Remove unused translation column
ALTER TABLE notes DROP COLUMN IF EXISTS clean_other_language;

-- QW3: Add AI processing status
ALTER TABLE notes ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'done';
```

- [ ] **Step 2: Apply the migration in Supabase**

Open the Supabase dashboard → SQL Editor → paste and run the migration.

Or using Supabase CLI if configured:
```bash
supabase db push
```

- [ ] **Step 3: Verify in Supabase dashboard**

Table Editor → `notes` → confirm `clean_other_language` is gone and `ai_status` column exists with default `'done'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_quick_wins.sql
git commit -m "feat: db migration — drop clean_other_language, add ai_status"
```

---

## Task 2: Update `types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Remove `clean_other_language` and add `ai_status` to the `Note` interface**

Replace the `Note` interface in `src/lib/types.ts`:

```typescript
export interface Note {
  id: string;
  created_at: string;
  updated_at: string;
  source: NoteSource;
  seen: boolean;
  categories: NoteCategory[];
  tags: string[];
  links: string[];
  original_text: string;
  clean_original_language: string | null;
  content_json?: any;
  full_text?: string | null;
  user_id?: string;
  ai_status: 'pending' | 'processing' | 'done' | 'failed';
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

Expected: TypeScript errors for every remaining reference to `clean_other_language` in other files — these are the files to fix in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ai_status to Note type, remove clean_other_language"
```

---

## Task 3: Remove `clean_other_language` References

**Files:**
- Modify: `src/app/api/notes/[id]/route.ts`
- Modify: `src/app/api/notes/[id]/chat/route.ts`
- Modify: `src/app/api/notes/route.ts`
- Modify: `src/app/api/notes/ingest/route.ts`

- [ ] **Step 1: Fix `src/app/api/notes/[id]/route.ts` — remove from ALLOWED_FIELDS**

Replace the `ALLOWED_FIELDS` constant:

```typescript
const ALLOWED_FIELDS = [
  "seen",
  "categories",
  "full_text",
  "original_text",
  "clean_original_language",
  "ai_status",
] as const;
```

- [ ] **Step 2: Fix `src/app/api/notes/[id]/chat/route.ts` — remove from select**

Find the line:
```typescript
.select('original_text, clean_original_language, clean_other_language, full_text')
```

Replace with:
```typescript
.select('original_text, clean_original_language, full_text')
```

- [ ] **Step 3: Fix `src/app/api/notes/route.ts` POST — remove `clean_original_language` insert**

The POST handler currently inserts `clean_original_language: title`. Remove that field:

```typescript
const { data, error } = await supabase
  .from("notes")
  .insert({
    original_text: title,
    source,
    seen: false,
    categories: [],
    user_id: user.id,
    ai_status: 'pending',
  })
  .select()
  .single();
```

- [ ] **Step 4: Fix `src/app/api/notes/ingest/route.ts` — remove clean_other_language update**

Find the block that sets `updates.clean_original_language`. This file already only sets `clean_original_language` (not `clean_other_language`), so no change needed there. Just verify:

```bash
grep -n "clean_other_language" src/app/api/notes/ingest/route.ts
```

Expected: no output (the field was never set there).

- [ ] **Step 5: Verify build is clean**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/notes/[id]/route.ts src/app/api/notes/[id]/chat/route.ts src/app/api/notes/route.ts
git commit -m "feat: remove clean_other_language refs, add ai_status to POST /api/notes"
```

---

## Task 4: Create `useRealtimeNotes` Hook

**Files:**
- Create: `src/lib/hooks/useRealtimeNotes.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/lib/hooks/useRealtimeNotes.ts
'use client';

import { useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { Note } from '@/lib/types';

interface UseRealtimeNotesOptions {
  userId: string | undefined;
  onInsert: (note: Note) => void;
  onUpdate: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

export function useRealtimeNotes({
  userId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeNotesOptions): void {
  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel('notes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onInsert(payload.new as Note),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onUpdate(payload.new as Note),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onDelete((payload.old as { id: string }).id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onInsert, onUpdate, onDelete]);
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Step 3: Enable Realtime on the `notes` table in Supabase**

Supabase dashboard → Database → Replication → enable `notes` table for all events (INSERT, UPDATE, DELETE).

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks/useRealtimeNotes.ts
git commit -m "feat: add useRealtimeNotes hook (Supabase Realtime)"
```

---

## Task 5: Replace Polling with Realtime in `page.tsx`

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import the hook and `useUser`**

The file already imports `useUser` from `@/lib/hooks/useUser`. Add the new hook import at the top:

```typescript
import { useRealtimeNotes } from '@/lib/hooks/useRealtimeNotes';
```

Also import `useCallback` if not already present (it is — line 3).

- [ ] **Step 2: Get `userId` from `useUser`**

The `useUser` hook currently returns `isAdmin`. Update usage to also get `userId`. First check what `useUser` returns by reading `src/lib/hooks/useUser.ts`. If it doesn't expose `userId`, add it.

To check:
```bash
cat src/lib/hooks/useUser.ts
```

If `useUser` returns a Supabase user object, extract the id. If it only returns `isAdmin`, add `userId` to its return value. The hook should call `supabase.auth.getUser()` and return `{ isAdmin, userId }`.

Update the `useUser` hook to also return `userId`:
```typescript
// In useUser hook, add to return value:
return { isAdmin: profile?.is_admin ?? false, userId: user?.id };
```

Then in `page.tsx`:
```typescript
const { isAdmin, userId } = useUser();
```

- [ ] **Step 3: Remove the polling `setInterval`**

Delete these lines (around line 142–148):

```typescript
// DELETE THIS BLOCK:
useEffect(() => {
  const interval = setInterval(() => {
    fetchNotes();
    fetchAllNotes();
  }, 15000);
  return () => clearInterval(interval);
}, [fetchNotes, fetchAllNotes]);
```

- [ ] **Step 4: Add `useRealtimeNotes` call**

After the existing `useEffect` calls, add:

```typescript
useRealtimeNotes({
  userId,
  onInsert: useCallback((note: Note) => {
    setAllNotes(prev => [note, ...prev.filter(n => n.id !== note.id)]);
    setNotes(prev => [note, ...prev.filter(n => n.id !== note.id)]);
  }, []),
  onUpdate: useCallback((note: Note) => {
    setAllNotes(prev => prev.map(n => n.id === note.id ? note : n));
    setNotes(prev => prev.map(n => n.id === note.id ? note : n));
    setSelected(prev => prev?.id === note.id ? { ...prev, ...note } : prev);
  }, []),
  onDelete: useCallback((noteId: string) => {
    setAllNotes(prev => prev.filter(n => n.id !== noteId));
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setSelected(prev => prev?.id === noteId ? null : prev);
  }, []),
});
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/lib/hooks/useUser.ts
git commit -m "feat: replace 15s polling with Supabase Realtime"
```

---

## Task 6: Create `NoteList` Component

**Files:**
- Create: `src/components/NoteList.tsx`

This component is extracted and extended from the existing `section === 'all'` list view in `page.tsx` (lines ~986–1078).

- [ ] **Step 1: Create the component**

```typescript
// src/components/NoteList.tsx
'use client';

import { useState } from 'react';
import type { Note } from '@/lib/types';
import { formatDate } from '@/lib/utils';

function noteTitle(note: Note): string {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  const isTweet =
    note.links?.some(l => tweetRegex.test(l)) ||
    tweetRegex.test(note.original_text ?? '');
  if (isTweet) return note.clean_original_language ?? note.original_text ?? '';
  return note.original_text ?? '';
}

interface NoteListProps {
  notes: Note[];
  loading: boolean;
  onSelect: (note: Note) => void;
  onDeleteMulti: (ids: string[]) => void;
  getCatColor: (cat: string) => string;
  getCatLabel: (cat: string) => string;
}

export function NoteList({
  notes,
  loading,
  onSelect,
  onDeleteMulti,
  getCatColor,
  getCatLabel,
}: NoteListProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    onDeleteMulti(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-8 py-6">
          <p className="text-[#606060] text-[14px]">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-8 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-[#9B9B9B]">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[13px] bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors duration-100"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Supprimer ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 rounded-[4px] text-[13px] border transition-colors duration-100
                ${selectMode
                  ? 'bg-[#2E7CD1]/15 border-[#2E7CD1]/30 text-[#2E7CD1]'
                  : 'bg-transparent border-[#2A2A2A] text-[#9B9B9B] hover:text-[#D4D4D4] hover:border-[#333]'
                }`}
            >
              {selectMode ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>
        </div>

        {/* List */}
        {notes.length === 0 ? (
          <p className="text-[#606060] text-[14px]">Aucune note</p>
        ) : (
          <div className="space-y-1">
            {notes.map(note => {
              const isChecked = selectedIds.has(note.id);
              return (
                <div
                  key={note.id}
                  onClick={() => selectMode ? toggleId(note.id) : onSelect(note)}
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-[6px] border transition-colors duration-100 cursor-pointer group
                    ${isChecked
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-[#252525] hover:bg-[#2A2A2A] border-[#2A2A2A] hover:border-[#333]'
                    }`}
                >
                  {selectMode && (
                    <div className={`w-4 h-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors duration-100
                      ${isChecked ? 'bg-red-500 border-red-500' : 'border-[#444]'}`}
                    >
                      {isChecked && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 6 5 9 10 3"/>
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-[#D4D4D4] truncate group-hover:text-white transition-colors duration-100">
                      {noteTitle(note)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[12px] text-[#9B9B9B]">{formatDate(note.created_at)}</span>
                      {note.categories.slice(0, 2).map(cat => (
                        <span key={cat} className={`text-[11px] px-1.5 py-[1px] rounded-[4px] border ${getCatColor(cat)}`}>
                          {getCatLabel(cat)}
                        </span>
                      ))}
                      {!note.seen && (
                        <span className="text-[11px] text-[#2E7CD1] font-medium">Nouveau</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NoteList.tsx
git commit -m "feat: add NoteList component"
```

---

## Task 7: Create `NoteDetail` Component

**Files:**
- Create: `src/components/NoteDetail.tsx`

This extracts the detail view from `page.tsx` lines 706–984. State that is local to the detail (title editing, chat, tweet display) moves inside this component. Category helpers and note-update callbacks come from props.

- [ ] **Step 1: Create the component**

```typescript
// src/components/NoteDetail.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note, NoteCategory } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { NoteEditor } from '@/components/NoteEditor';
import { TweetEmbed } from '@/components/TweetEmbed';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

function extractTweetUrls(links: string[], originalText: string): string[] {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/gi;
  const fromLinks = links.filter(l => /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i.test(l));
  if (fromLinks.length > 0) return fromLinks;
  return [...originalText.matchAll(tweetRegex)].map(m => m[0]);
}

function extractYoutubeUrls(links: string[] | null): string[] {
  return (links ?? []).filter(l => /https?:\/\/(www\.)?youtube\.com\/watch\?v=/.test(l));
}

function noteTitle(note: Note): string {
  const isTweet = extractTweetUrls(note.links ?? [], note.original_text ?? '').length > 0;
  if (isTweet) return note.clean_original_language ?? note.original_text ?? '';
  return note.original_text ?? '';
}

interface NoteDetailProps {
  note: Note;
  onBack: () => void;
  onNoteUpdated: (note: Note) => void;
  onDeleteRequest: (id: string) => void;
  getCatColor: (cat: string) => string;
  getCatLabel: (cat: string) => string;
  getAllCategories: () => (NoteCategory | string)[];
}

export function NoteDetail({
  note,
  onBack,
  onNoteUpdated,
  onDeleteRequest,
  getCatColor,
  getCatLabel,
  getAllCategories,
}: NoteDetailProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [tweetText, setTweetText] = useState<string | null>(null);

  const [classifying, setClassifying] = useState(false);

  // Reset local state when note changes
  useEffect(() => {
    setTweetText(null);
    setChatMessages([]);
    setChatInput('');
    setShowChat(false);
    setEditingTitle(false);
  }, [note.id]);

  // Load chat history when note opens
  useEffect(() => {
    fetch(`/api/notes/${note.id}/chat`)
      .then(r => r.json())
      .then(data => setChatMessages(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [note.id]);

  const saveTitle = useCallback(async () => {
    if (!titleValue.trim()) return;
    const newTitle = titleValue.trim();
    setEditingTitle(false);
    const updated = { ...note, original_text: newTitle };
    onNoteUpdated(updated);
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_text: newTitle }),
    });
  }, [note, titleValue, onNoteUpdated]);

  const updateNoteCategories = async (newCategories: NoteCategory[]) => {
    const updated = { ...note, categories: newCategories };
    onNoteUpdated(updated);
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: newCategories }),
    });
  };

  const handleClassifyWithAI = async () => {
    setClassifying(true);
    onNoteUpdated({ ...note, ai_status: 'processing' });
    try {
      const res = await fetch('/api/notes/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: note.id }),
      });
      const data = await res.json();
      if (data.note) onNoteUpdated(data.note);
    } catch {
      onNoteUpdated({ ...note, ai_status: 'failed' });
    } finally {
      setClassifying(false);
    }
  };

  const tweetUrls = extractTweetUrls(note.links ?? [], note.original_text ?? '');
  const youtubeUrls = extractYoutubeUrls(note.links);

  const editorInitialText = (() => {
    const isTweet = tweetUrls.length > 0;
    if (isTweet) return tweetText ?? note.full_text ?? '';
    const fullText = note.full_text ?? note.clean_original_language ?? note.original_text ?? '';
    if (youtubeUrls.length > 0) {
      return fullText.replace(/^🔗 https?:\/\/[^\n]+\n\n/, '');
    }
    return fullText;
  })();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-[900px] mx-auto px-8 pt-6 pb-16">

          {/* AI Status Banner (QW3) */}
          {note.ai_status === 'processing' && (
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[13px]">
              <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Classification IA en cours…
            </div>
          )}
          {note.ai_status === 'failed' && (
            <div className="mb-4 flex items-center justify-between gap-2 px-4 py-2.5 rounded-[6px] bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              <span>Erreur lors de la classification IA.</span>
              <button
                onClick={handleClassifyWithAI}
                disabled={classifying}
                className="text-[12px] underline hover:no-underline disabled:opacity-50"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Top actions */}
          <div className="flex justify-end items-center gap-2 mb-6">
            {/* QW2: Classify with AI button */}
            {note.source === 'desktop' && note.ai_status === 'pending' && (
              <button
                onClick={handleClassifyWithAI}
                disabled={classifying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[13px] transition-colors duration-100 border bg-transparent border-[#2A2A2A] text-[#9B9B9B] hover:text-[#D4D4D4] hover:border-[#333] disabled:opacity-40"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 1 10 10"/><circle cx="12" cy="12" r="3"/>
                </svg>
                Classer avec l'IA
              </button>
            )}

            <button
              onClick={() => setShowChat(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[13px] transition-colors duration-100 border
                ${showChat
                  ? 'bg-[#2E7CD1]/15 border-[#2E7CD1]/30 text-[#2E7CD1]'
                  : 'bg-transparent border-[#2A2A2A] text-[#9B9B9B] hover:text-[#D4D4D4] hover:border-[#333]'
                }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat IA
              {chatMessages.length > 0 && (
                <span className="text-[10px] bg-[#2E7CD1] text-white rounded-full px-1.5 py-0.5 font-mono tabular-nums">
                  {chatMessages.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onDeleteRequest(note.id)}
              className="text-[#606060] hover:text-red-400 w-6 h-6 flex items-center justify-center rounded-[4px] hover:bg-red-500/10 transition-colors duration-100"
              title="Supprimer cette note"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>

            <button
              onClick={onBack}
              className="text-[#606060] hover:text-[#D4D4D4] text-lg leading-none transition-colors duration-100 w-6 h-6 flex items-center justify-center rounded-[4px] hover:bg-[#2A2A2A]"
            >
              ×
            </button>
          </div>

          {/* Title */}
          <div className="mb-4">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="w-full bg-transparent text-[28px] font-semibold text-[#D4D4D4] mb-4 leading-snug focus:outline-none border-b border-[#2E7CD1] pb-1"
                autoFocus
              />
            ) : (
              <h1
                className="text-[28px] font-semibold text-[#D4D4D4] mb-4 leading-snug cursor-text hover:text-white transition-colors duration-100"
                onClick={() => {
                  setEditingTitle(true);
                  setTitleValue(note.original_text ?? '');
                  setTimeout(() => titleInputRef.current?.select(), 30);
                }}
                title="Cliquer pour modifier le titre"
              >
                {noteTitle(note)}
              </h1>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[13px] text-[#9B9B9B]">{formatDate(note.created_at)}</span>
              <span className="text-[#2A2A2A]">·</span>
              <span className="text-[13px] text-[#9B9B9B] capitalize">{note.source}</span>
              {note.categories.length > 0 && <span className="text-[#2A2A2A]">·</span>}
              {note.categories.map(cat => (
                <span
                  key={cat}
                  className={`text-[12px] px-2 py-[2px] rounded-[4px] border flex items-center gap-1 ${getCatColor(cat)}`}
                >
                  {getCatLabel(cat)}
                  <button
                    onClick={() => updateNoteCategories(note.categories.filter(c => c !== cat) as NoteCategory[])}
                    className="opacity-50 hover:opacity-100 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                value=""
                onChange={e => {
                  const cat = e.target.value as NoteCategory;
                  if (cat && !note.categories.includes(cat)) {
                    updateNoteCategories([...note.categories, cat] as NoteCategory[]);
                  }
                }}
                className="text-[12px] bg-transparent border border-[#2A2A2A] rounded-[4px] px-2 py-[2px] text-[#9B9B9B] focus:outline-none hover:border-[#333] hover:text-[#D4D4D4] cursor-pointer transition-colors duration-100"
              >
                <option value="">+ Catégorie</option>
                {getAllCategories()
                  .filter(c => !note.categories.includes(c as NoteCategory))
                  .map(cat => (
                    <option key={cat} value={cat}>{getCatLabel(cat)}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="border-b border-[#2A2A2A] mb-4" />

          {/* Tweet Embed */}
          {tweetUrls.length > 0 && (
            <div className="mb-6 space-y-3">
              {tweetUrls.map(url => (
                <TweetEmbed key={url} url={url} onData={d => setTweetText(d.text)} />
              ))}
            </div>
          )}

          {/* YouTube Link */}
          {youtubeUrls.length > 0 && (
            <div className="mb-4 flex flex-col gap-1">
              {youtubeUrls.map(url => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#2E7CD1] hover:underline break-all"
                >
                  {url}
                </a>
              ))}
            </div>
          )}

          {/* Editor */}
          <NoteEditor noteId={note.id} initialFullText={editorInitialText} />
        </div>
      </div>

      {/* Chat IA panel */}
      {showChat && (
        <div className="h-[320px] shrink-0 border-t border-[#2A2A2A] flex flex-col bg-[#191919]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2A2A2A] shrink-0">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2E7CD1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-[13px] font-medium text-[#D4D4D4]">Chat IA</span>
              <span className="text-[12px] text-[#606060]">— réfléchissons ensemble</span>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="text-[#606060] hover:text-[#D4D4D4] w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-[#2A2A2A] transition-colors duration-100 text-base leading-none"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <p className="text-[13px] text-[#606060] text-center pt-6">Pose une question sur cette note…</p>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-[6px] text-[13px] leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-[#2E7CD1] text-white rounded-br-[2px]'
                      : 'bg-[#252525] text-[#D4D4D4] border border-[#2A2A2A] rounded-bl-[2px]'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#252525] border border-[#2A2A2A] rounded-[6px] rounded-bl-[2px] px-3 py-2">
                  <span className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-[#2A2A2A] shrink-0">
            <form
              onSubmit={async e => {
                e.preventDefault();
                const msg = chatInput.trim();
                if (!msg || chatLoading) return;
                const optimistic: ChatMessage = {
                  id: Date.now().toString(),
                  role: 'user',
                  content: msg,
                  created_at: new Date().toISOString(),
                };
                setChatMessages(prev => [...prev, optimistic]);
                setChatInput('');
                setChatLoading(true);
                setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                try {
                  const res = await fetch(`/api/notes/${note.id}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg }),
                  });
                  const data = await res.json();
                  const reply: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.reply ?? 'Erreur',
                    created_at: new Date().toISOString(),
                  };
                  setChatMessages(prev => [...prev, reply]);
                } catch {
                  setChatMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Erreur de connexion.',
                    created_at: new Date().toISOString(),
                  }]);
                } finally {
                  setChatLoading(false);
                  setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Écris ton message…"
                disabled={chatLoading}
                className="flex-1 bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-3 py-2 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#2E7CD1] hover:bg-[#2568B8] text-white px-3 py-2 rounded-[4px] text-[13px] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NoteDetail.tsx
git commit -m "feat: add NoteDetail component (extracted from page.tsx)"
```

---

## Task 8: Refactor `page.tsx` Main Panel

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add imports for NoteList and NoteDetail**

At the top of `page.tsx`, add:

```typescript
import { NoteList } from '@/components/NoteList';
import { NoteDetail } from '@/components/NoteDetail';
```

- [ ] **Step 2: Remove state that moved into NoteDetail**

Delete these state declarations (they now live in NoteDetail):

```typescript
// DELETE these lines:
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };
const [showChat, setShowChat] = useState(false);
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
const [chatInput, setChatInput] = useState('');
const [chatLoading, setChatLoading] = useState(false);
const chatBottomRef = useRef<HTMLDivElement>(null);
const [editingTitle, setEditingTitle] = useState(false);
const [titleValue, setTitleValue] = useState('');
const titleInputRef = useRef<HTMLInputElement>(null);
const [tweetText, setTweetText] = useState<string | null>(null);
```

Also delete the `saveTitle` and `updateNoteCategories` functions (moved to NoteDetail). Keep `deleteNotes`.

- [ ] **Step 3: Remove select mode state (moved to NoteList)**

```typescript
// DELETE these:
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 4: Update `openNote` function**

The `openNote` function previously set title/chat state. Simplify it — it only needs to set `selected` and mark as seen:

```typescript
const openNote = async (note: Note) => {
  setSelected({ ...note, seen: true });

  // Expand la première catégorie de la note dans la sidebar
  if (note.categories.length > 0) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      note.categories.forEach(cat => next.add(cat));
      return next;
    });
  }

  if (!note.seen) {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seen: true }),
      });
      if (!res.ok) return;
      const updated: Note = await res.json();
      setNotes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
      setAllNotes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
    } catch (e) {
      console.error('Failed to update note seen status', e);
    }
  }
};
```

- [ ] **Step 5: Replace the main panel JSX**

Find the `{/* Zone principale */}` comment (around line 661). Replace everything from `{selected ? (` down to the empty state `</div>` with:

```tsx
{/* Contenu — note ouverte ou liste */}
{selected ? (
  <NoteDetail
    note={selected}
    onBack={() => setSelected(null)}
    onNoteUpdated={(updated) => {
      setSelected(updated);
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      setAllNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    }}
    onDeleteRequest={(id) => setConfirmDelete(id)}
    getCatColor={getCatColor}
    getCatLabel={getCatLabel}
    getAllCategories={getAllCategories}
  />
) : (
  <NoteList
    notes={notes}
    loading={loading}
    onSelect={openNote}
    onDeleteMulti={(ids) => { deleteNotes(ids); }}
    getCatColor={getCatColor}
    getCatLabel={getCatLabel}
  />
)}
```

Note: the delete modal for single notes (`confirmDelete === string`) stays in page.tsx unchanged. Remove the `confirmDelete === 'multi'` branch from the modal since NoteList now handles multi-delete directly via `deleteNotes`.

Update the modal's delete handler:

```tsx
onClick={() => {
  deleteNotes([confirmDelete as string]);
}}
```

And update the modal title:
```tsx
<p className="text-[14px] font-medium text-[#D4D4D4]">
  Supprimer cette note ?
</p>
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Fix any remaining TypeScript errors (usually unused imports or stale references).

- [ ] **Step 7: Test manually**

```bash
npm run dev
```

- Navigate to any category in the sidebar → main panel should show a list of notes
- Click a note → detail view appears
- Click × → back to list
- Search something → list updates
- Change period filter → list updates

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: refactor page.tsx — use NoteList/NoteDetail, list always visible when no note selected"
```

---

## Task 9: Update Ingest API for Desktop Notes

**Files:**
- Modify: `src/app/api/notes/ingest/route.ts`

- [ ] **Step 1: Add `note_id` flow at the top of the handler**

Replace the entire handler body with:

```typescript
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const body = await req.json();

    const noteId = body?.note_id as string | undefined;

    // ── Flow B: classify an existing desktop note ──────────────────────────
    if (noteId) {
      const { data: existingNote, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (fetchError || !existingNote) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      const text = existingNote.original_text as string;
      const userId = existingNote.user_id as string;

      // Mark as processing
      await supabase
        .from('notes')
        .update({ ai_status: 'processing' })
        .eq('id', noteId);

      // Load custom categories
      const { data: dbCategories } = await supabase
        .from('categories')
        .select('id, label, description')
        .eq('user_id', userId)
        .eq('is_builtin', false)
        .eq('hidden', false);

      const customCategories = dbCategories ?? [];

      const [classifyResult, rewriteResult] = await Promise.allSettled([
        classifyNote(text, customCategories),
        rewriteNote(text),
      ]);

      const updates: Record<string, unknown> = { ai_status: 'done' };

      if (classifyResult.status === 'fulfilled') {
        updates.categories = classifyResult.value.categories;
      }
      if (rewriteResult.status === 'fulfilled') {
        updates.clean_original_language = rewriteResult.value.clean_original_language;
      }
      if (classifyResult.status === 'rejected' && rewriteResult.status === 'rejected') {
        updates.ai_status = 'failed';
      }

      const { data: updated, error: updateError } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', noteId)
        .select()
        .single();

      if (updateError) {
        await supabase.from('notes').update({ ai_status: 'failed' }).eq('id', noteId);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, note: updated }, { status: 200 });
    }

    // ── Flow A: create + classify new note (Telegram / YouTube) ───────────
    const text = body?.text as string | undefined;
    const source = (body?.source as string | undefined) ?? 'telegram';
    const userId = body?.user_id as string | undefined;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({ original_text: text, source, seen: false, user_id: userId, ai_status: 'processing' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: dbCategories } = await supabase
      .from('categories')
      .select('id, label, description')
      .eq('user_id', userId)
      .eq('is_builtin', false)
      .eq('hidden', false);

    const customCategories = dbCategories ?? [];

    const tweetUrlMatch = text.trim().match(/^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i);
    let tweetTitle: string | null = null;
    let tweetFullText: string | null = null;

    if (tweetUrlMatch) {
      try {
        const cleanUrl = text.trim().split('?')[0];
        const tweetIdMatch = cleanUrl.match(/\/status\/(\d+)/);
        const tweetId = tweetIdMatch?.[1];
        const bearerToken = process.env.TWITTER_BEARER_TOKEN;
        let cleanedText = '';

        if (tweetId && bearerToken) {
          const v2Res = await fetch(
            `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text`,
            { headers: { Authorization: `Bearer ${bearerToken}` } },
          );
          if (v2Res.ok) {
            const v2Data = await v2Res.json();
            if (v2Data.data?.text) {
              cleanedText = v2Data.data.text
                .replace(/\s*(https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/g, '')
                .trim();
            }
          }
        }

        if (!cleanedText) {
          const oembedRes = await fetch(
            `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}&dnt=true&omit_script=true`,
          );
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            const pMatch = oembedData.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            const rawText = pMatch?.[1] ?? '';
            cleanedText = rawText
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
              .replace(/\s*(https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/g, '')
              .trim();
          }
        }

        if (cleanedText) {
          tweetFullText = cleanedText;
          const words = cleanedText.split(/\s+/);
          tweetTitle = words.length > 15 ? words.slice(0, 15).join(' ') + '…' : cleanedText;
        }
      } catch {
        // Ignore
      }
    }

    const [classifyResult, rewriteResult] = await Promise.allSettled([
      classifyNote(tweetTitle ?? text, customCategories),
      tweetTitle
        ? Promise.resolve({ clean_original_language: tweetTitle })
        : rewriteNote(text),
    ]);

    const updates: Record<string, unknown> = { ai_status: 'done' };

    if (classifyResult.status === 'fulfilled') {
      const cats = classifyResult.value.categories as string[];
      if (tweetUrlMatch && !cats.includes('twitter')) cats.unshift('twitter');
      updates.categories = cats;
    } else if (tweetUrlMatch) {
      updates.categories = ['twitter'];
    }
    if (rewriteResult.status === 'fulfilled') {
      updates.clean_original_language = rewriteResult.value.clean_original_language;
    }
    if (tweetFullText) {
      updates.full_text = tweetFullText;
    }
    if (classifyResult.status === 'rejected' && rewriteResult.status === 'rejected') {
      updates.ai_status = 'failed';
    }

    if (Object.keys(updates).length === 1 && updates.ai_status === 'done') {
      return NextResponse.json({ ok: true, note: data }, { status: 200 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', data.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ ok: true, note: data }, { status: 200 });
    }

    return NextResponse.json({ ok: true, note: updated }, { status: 200 });
  } catch (err) {
    console.error('Error in /api/notes/ingest', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Test desktop flow manually**

```bash
npm run dev
```

1. Create a new note (click `+` → "Créer une note")
2. Note opens with empty content — verify `ai_status = 'pending'` in Supabase Table Editor
3. Click "Classer avec l'IA" button in the note detail
4. Banner "Classification IA en cours…" should appear
5. After a few seconds, categories should appear and banner should disappear
6. Check Supabase — `ai_status` should be `'done'`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/notes/ingest/route.ts
git commit -m "feat: ingest API accepts note_id for desktop notes, sets ai_status lifecycle"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] QW5 — `clean_other_language` dropped in Task 1, removed from code in Task 3
- [x] QW3-DB — `ai_status` column added in Task 1
- [x] QW4 — Realtime hook in Task 4, polling removed in Task 5
- [x] QW1 — NoteList in Task 6, refactor in Task 8
- [x] QW2 — "Classer avec l'IA" button in NoteDetail (Task 7), ingest API in Task 9
- [x] QW3-UI — AI banner in NoteDetail (Task 7), driven by `ai_status` prop

**Type consistency:**
- `Note.ai_status` defined in Task 2, used in Tasks 7, 9 ✓
- `NoteDetailProps.onNoteUpdated(note: Note)` defined in Task 7, called in Task 8 ✓
- `NoteListProps.onDeleteMulti(ids: string[])` defined in Task 6, called in Task 8 ✓
- `useRealtimeNotes` options defined in Task 4, used in Task 5 ✓

**No placeholders:** All code blocks are complete.

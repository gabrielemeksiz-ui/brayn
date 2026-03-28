# Design — Quick Wins Sprint (QW1–QW5)

**Date:** 2026-03-28
**Status:** Approved

---

## Scope

5 features from the Brayn UX roadmap:

| ID | Feature |
|----|---------|
| QW5 | Supprimer `clean_other_language` |
| QW3-DB | Ajouter colonne `ai_status` sur `notes` |
| QW4 | Remplacer polling 15s par Supabase Realtime |
| QW1 | Liste de notes dans le panneau principal |
| QW2 | Ingestion IA pour les notes créées en desktop |
| QW3-UI | Bannière indicateur "IA en cours" dans le détail |

---

## Section 1 — Changements DB

### QW5 — Supprimer `clean_other_language`

- Migration SQL : `ALTER TABLE notes DROP COLUMN clean_other_language;`
- Retirer `clean_other_language` du type `Note` dans `src/lib/types.ts`
- Supprimer toutes les références dans le code (API routes, `page.tsx`, `NoteEditor.tsx`)

### QW3 — Colonne `ai_status`

- Migration SQL : `ALTER TABLE notes ADD COLUMN ai_status text DEFAULT 'done';`
- Valeurs possibles :
  - `'pending'` — note créée, pipeline IA pas encore lancé
  - `'processing'` — pipeline IA en cours
  - `'done'` — traitement terminé (défaut pour les notes existantes)
  - `'failed'` — erreur pendant l'ingestion
- Flux :
  - Nouvelle note desktop créée → `ai_status = 'pending'`
  - Début ingestion → `ai_status = 'processing'`
  - Fin ingestion (succès) → `ai_status = 'done'`
  - Erreur ingestion → `ai_status = 'failed'`
- Ajouter `ai_status: 'pending' | 'processing' | 'done' | 'failed'` au type `Note` dans `src/lib/types.ts`

---

## Section 2 — Supabase Realtime (QW4)

**Objectif :** remplacer le `setInterval` de 15s par une subscription WebSocket.

### Hook `useRealtimeNotes`

Nouveau fichier : `src/lib/hooks/useRealtimeNotes.ts`

- Subscribe aux events `INSERT`, `UPDATE`, `DELETE` sur la table `notes`, filtrés par `user_id`
- Expose des callbacks : `onInsert(note)`, `onUpdate(note)`, `onDelete(noteId)`
- Cleanup de la subscription au unmount

### Modifications `page.tsx`

- Supprimer le `setInterval` de 15s
- Utiliser `useRealtimeNotes` pour maintenir `allNotes` à jour en temps réel
- Le fetch initial au montage est conservé

### Pré-requis Supabase

- RLS sur `notes` doit autoriser les SELECT pour l'utilisateur authentifié (déjà en place)
- Realtime doit être activé sur la table `notes` dans le dashboard Supabase

---

## Section 3 — Liste de notes dans le panneau principal (QW1)

**Layout choisi :** Option A — 2 colonnes, liste remplace le détail
**Format des cartes :** Compact (titre + date + catégories, ligne unique)

### Nouveaux composants

**`src/components/NoteList.tsx`**
- Affiche une liste de cartes compactes
- Props : `notes: Note[]`, `selected: Note | null`, `onSelect: (note: Note) => void`
- Chaque carte affiche : titre (`noteTitle()`), date relative, catégories (badges)
- Aucun indicateur IA dans la liste (l'indicateur est réservé au détail — QW3)

**`src/components/NoteDetail.tsx`**
- Affiche le détail complet d'une note (contenu actuel du panneau droit de `page.tsx`)
- Props : `note: Note`, `onBack: () => void`, + callbacks existants
- Bouton "← Retour" pour revenir à la liste

### Comportement

- Cliquer une catégorie dans la sidebar → panneau principal affiche `<NoteList>` filtrée par catégorie
- Sections "Nouveau" et "Tout" → affichent aussi `<NoteList>` (notes non vues / toutes les notes)
- Cliquer une note dans `<NoteList>` → affiche `<NoteDetail>` (remplace la liste)
- Bouton "← Retour" dans `<NoteDetail>` → revient à `<NoteList>`
- Recherche et filtres période au sommet filtrent la `<NoteList>` active

### `page.tsx` après refactor

Rôle réduit à : orchestration du state, fetch initial, sidebar, layout global. Tout le JSX de détail déplacé dans `NoteDetail.tsx`.

---

## Section 4 — Ingestion IA desktop + Indicateur (QW2 + QW3 UI)

### QW2 — Bouton "Classer avec l'IA"

- Dans `<NoteDetail>` : afficher un bouton "Classer avec l'IA" quand `note.source === 'desktop'` ET `note.ai_status === 'pending'`
- Clic → `POST /api/notes/ingest` avec `{ note_id: note.id }`
- Modifier `src/app/api/notes/ingest/route.ts` pour accepter soit `{ text, source }` (flow existant), soit `{ note_id }` (note desktop existante) :
  - Si `note_id` → charger la note depuis la DB, lancer classify + rewrite, mettre à jour en DB
  - Mettre `ai_status = 'processing'` au début, `'done'` ou `'failed'` à la fin
- Création d'une note desktop (`POST /api/notes`) → crée avec `ai_status = 'pending'`

### QW3 UI — Bannière dans le détail

- Dans `<NoteDetail>` :
  - `ai_status === 'processing'` → bannière orange en haut : "Classification IA en cours..."
  - `ai_status === 'failed'` → bannière rouge : "Erreur IA" + bouton "Réessayer" (relance l'ingestion)
  - `ai_status === 'pending'` → rien (le bouton QW2 suffit)
  - `ai_status === 'done'` → rien
- Grâce au Realtime (QW4), la bannière disparaît automatiquement quand l'IA termine

---

## Ordre d'implémentation

1. Migration DB (QW5 + QW3-DB)
2. Supabase Realtime hook (QW4)
3. Composants NoteList + NoteDetail, refactor page.tsx (QW1)
4. Ingest route + bouton desktop + bannière (QW2 + QW3-UI)

---

## Fichiers concernés

| Fichier | Changement |
|---------|-----------|
| `supabase/migrations/` | Nouvelle migration SQL |
| `src/lib/types.ts` | Retirer `clean_other_language`, ajouter `ai_status` |
| `src/lib/hooks/useRealtimeNotes.ts` | Nouveau hook |
| `src/app/page.tsx` | Supprimer polling, utiliser Realtime, extraire JSX |
| `src/components/NoteList.tsx` | Nouveau composant |
| `src/components/NoteDetail.tsx` | Nouveau composant (extrait de page.tsx) |
| `src/components/NoteEditor.tsx` | Supprimer références `clean_other_language` |
| `src/app/api/notes/route.ts` | Créer avec `ai_status = 'pending'` pour desktop |
| `src/app/api/notes/ingest/route.ts` | Accepter `note_id` en plus du flow text |
| `src/app/api/notes/[id]/route.ts` | Vérifier pas de ref à `clean_other_language` |

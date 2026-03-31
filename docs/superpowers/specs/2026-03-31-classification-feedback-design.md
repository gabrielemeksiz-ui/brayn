# Classification Feedback — Raffinement IA en temps réel

**Date** : 2026-03-31
**Statut** : Approuvé

## Objectif

Permettre à l'IA de classification de Brayn d'apprendre en temps réel de ses erreurs grâce aux corrections et validations de l'utilisateur, via 3 mécanismes : correction explicite, validation implicite (seen), et bouton de validation.

## Modèle de données

### Nouvelle colonne sur `notes`

- `ai_categories text[]` — snapshot de la prédiction IA originale (les `categories` existantes sont modifiables par l'user, on perd sinon la trace de ce que l'IA avait prédit)

### Nouvelle table `classification_feedback`

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| id | UUID | PK, default gen_random_uuid() | |
| note_id | UUID | UNIQUE, FK → notes ON DELETE CASCADE | Un seul feedback par note (upsert) |
| user_id | UUID | FK → auth.users | |
| original_text | text | NOT NULL | Snapshot du texte au moment de la classification |
| ai_categories | text[] | NOT NULL | Ce que l'IA avait prédit |
| user_categories | text[] | NOT NULL | Catégories finales retenues |
| feedback_type | text | NOT NULL, CHECK IN ('correction', 'implicit_validation', 'explicit_validation') | |
| created_at | timestamptz | default now() | |

**RLS** : `user_id = auth.uid()` pour SELECT, INSERT, UPDATE.

## Capture des 3 signaux

### Signal A — Correction explicite

**Déclencheur** : PATCH `/api/notes/[id]` avec `categories` dans le body.

**Logique** :
1. Après le update Supabase, récupérer la note mise à jour
2. Comparer `body.categories` avec `note.ai_categories`
3. Si différents → upsert dans `classification_feedback` avec `feedback_type = 'correction'`
4. Si identiques (l'user remet les catégories IA) → upsert avec `feedback_type = 'explicit_validation'`

### Signal B — Validation implicite

**Déclencheur** : PATCH `/api/notes/[id]` avec `seen: true`.

**Logique** :
1. Après le update, vérifier si un feedback existe déjà pour cette note
2. Si non → insérer feedback `feedback_type = 'implicit_validation'` avec `user_categories = ai_categories`
3. Si oui → ne rien faire (ne pas écraser une correction par une validation implicite)

### Signal C — Bouton de validation explicite

**Déclencheur** : POST `/api/notes/[id]/validate-classification`

**Logique** :
1. Récupérer la note
2. Upsert feedback `feedback_type = 'explicit_validation'` avec `user_categories = note.categories`

**Règle d'upsert** : une correction ne doit jamais être écrasée par une validation implicite. Ordre de priorité : `correction` > `explicit_validation` > `implicit_validation`. L'upsert ne downgrade jamais le type.

## Few-shot dynamique dans `classifyNote()`

### Sélection des exemples

Au moment de classifier une nouvelle note :

1. **Récents** : fetch les 3 feedbacks les plus récents de type `correction` ou `explicit_validation`
2. **Par catégorie** : fetch les 3 feedbacks de type `correction` dont `ai_categories` ou `user_categories` contiennent les catégories les plus fréquemment corrigées (top 3 catégories par nombre de corrections sur 30 jours)
3. Dédupliquer par `note_id`, limiter à 5 exemples max
4. Tronquer `original_text` à 100 caractères

### Injection dans le prompt

Ajouter après les règles de classification, avant la note à classer :

```
Exemples de classements corrigés/validés par l'utilisateur (utilise-les pour calibrer ton jugement) :

- "texte tronqué..." → [cat1, cat2] (corrigé, l'IA avait mis [cat3])
- "texte tronqué..." → [cat1] (validé par l'utilisateur)
```

Ne pas injecter si aucun feedback n'existe (nouveau user).

### Pondération

Les exemples de type `correction` sont injectés en priorité (signal le plus fort). Les `explicit_validation` complètent si < 5 exemples. Les `implicit_validation` ne sont jamais injectés dans le prompt.

## Bouton UI "Bon classement"

### Emplacement

Dans le panneau de détail de la note (NoteDetail), sous les badges de catégories.

### Comportement

- **Non validé** : icône check outline, couleur neutre (`text-[#666]`), tooltip "Valider le classement"
- **Au clic** : POST `/api/notes/[id]/validate-classification` → icône remplie, couleur verte (`text-green-500`), tooltip "Classement validé"
- **Déjà corrigé** : si un feedback de type `correction` existe, le bouton affiche "Classement corrigé" (icône edit, non cliquable)
- **État** : dérivé de la présence/type du feedback pour cette note (pas de colonne booléenne supplémentaire)

### Fetch de l'état

Quand on charge une note, fetch aussi le feedback associé (jointure ou query séparée) pour afficher l'état du bouton.

## Suggestions d'amélioration `ai_description` (couche 3)

### Endpoint

GET `/api/categories/suggestions`

### Logique

1. Pour chaque catégorie, compter les corrections des 30 derniers jours où cette catégorie était dans `ai_categories` mais pas dans `user_categories` (faux positif) ou dans `user_categories` mais pas dans `ai_categories` (faux négatif)
2. Calculer le taux de correction : `corrections / (corrections + validations)`
3. Si taux > 30% → appeler l'IA avec les exemples de corrections pour générer une suggestion d'amélioration de `ai_description`

### Réponse

```json
[
  {
    "category_id": "stocks_watchlist",
    "current_description": "...",
    "suggested_description": "...",
    "reason": "Souvent confondue avec Crypto-Web3 pour les mentions de BTC/ETH",
    "stats": { "corrections": 8, "total": 20, "error_rate": 0.4 }
  }
]
```

### Affichage

Dans le gestionnaire de catégories, banner/notification sur les catégories avec suggestions disponibles. L'utilisateur peut accepter (update `ai_description`), ignorer, ou modifier manuellement.

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Nouvelle table `classification_feedback`, colonne `ai_categories` sur `notes` |
| `src/lib/ai.ts` | `classifyNote()` : fetch feedbacks + injection few-shot |
| `src/app/api/notes/[id]/route.ts` | PATCH : détecter corrections et validations implicites |
| `src/app/api/notes/[id]/validate-classification/route.ts` | Nouveau : POST validation explicite |
| `src/app/api/notes/ingest/route.ts` | Sauvegarder `ai_categories` lors de l'ingestion |
| `src/app/api/categories/suggestions/route.ts` | Nouveau : GET suggestions |
| `src/app/page.tsx` ou composant NoteDetail | Bouton "bon classement" + état |
| `src/lib/types.ts` | Types pour feedback, suggestions |

## Hors scope

- Embeddings / recherche sémantique (on utilise récence + catégorie pour la sélection few-shot)
- Auto-application des suggestions (toujours manuelle)
- Historique des modifications de `ai_description`
- Export/import des feedbacks

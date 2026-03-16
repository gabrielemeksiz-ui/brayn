# Brayn — Second cerveau personnel

## Stack technique

- **Framework** : Next.js 16.1.6 (React 19, TypeScript 5)
- **Base de données** : Supabase (PostgreSQL)
- **IA** : Groq (llama-3.3-70b-versatile) via OpenAI SDK
- **Styling** : Tailwind CSS 4
- **Déploiement** : Vercel (avec Cron Jobs)
- **Intégrations** : Telegram Bot, Twitter API v2, YouTube Data API v3

## Architecture

```
src/
  app/
    page.tsx                    # Dashboard principal (SPA client-side)
    layout.tsx                  # Layout global (dark theme, Inter font)
    login/page.tsx              # Page de connexion
    api/
      auth/route.ts             # Auth par mot de passe (cookie brayn_auth)
      notes/route.ts            # GET (liste filtrée) + POST (création)
      notes/ingest/route.ts     # Pipeline d'ingestion IA (classify + rewrite)
      notes/[id]/route.ts       # PATCH + DELETE note
      notes/[id]/chat/route.ts  # Chat contextuel par note
      categories/route.ts       # GET + POST (upsert) catégories
      categories/[id]/route.ts  # PATCH + DELETE catégorie
      bot/route.ts              # Webhook Telegram
      tweet-embed/route.ts      # Fetch métadonnées tweet (API v2 + fallback oEmbed)
      youtube/sync/route.ts     # Sync manuelle YouTube
      cron/youtube/route.ts     # Cron horaire : import playlist YouTube
  components/
    NoteEditor.tsx              # Textarea auto-grow avec auto-save (2s) + lien YouTube cliquable
    TweetEmbed.tsx              # Affichage embed tweet
  lib/
    ai.ts                       # Fonctions IA : classifyNote, rewriteNote, summarizeYouTubeVideo, summarizeVideo
    supabase.ts                 # Client Supabase server-side (service role)
    types.ts                    # Types, catégories, couleurs, labels
    utils.ts                    # extractLinks, formatDate
  middleware.ts                 # Auth middleware (cookie check, skip en dev)
```

## Base de données (Supabase)

### Table `notes`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| created_at | timestamp | Date de création |
| updated_at | timestamp | Dernière modification |
| source | text | `telegram`, `desktop` |
| seen | boolean | Lu par l'utilisateur |
| categories | text[] | IDs de catégories |
| tags | string[] | Tags manuels |
| links | string[] | URLs extraites |
| original_text | text | Texte brut original (titre pour YouTube) |
| clean_original_language | text | Réécriture IA (résumé pour YouTube) |
| clean_other_language | text | Traduction optionnelle |
| content_json | jsonb | Données BlockNote |
| full_text | text | Contenu étendu (transcription YouTube) |

### Table `categories`
| Colonne | Type | Description |
|---------|------|-------------|
| id | text | PK (slug) |
| label | text | Nom affiché |
| description | text | Description optionnelle |
| is_builtin | boolean | Catégorie native vs custom |
| hidden | boolean | Masquée dans l'UI |

### Table `note_chats`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| note_id | UUID | FK → notes.id |
| role | text | `user` ou `assistant` |
| content | text | Message |

## Catégories (12 built-in)

`business_project`, `personal_reflection`, `interesting_topic`, `conspiracy_theory`, `stocks_watchlist`, `need`, `finance`, `géopolitique`, `Crypto-Web3`, `outils`, `twitter` (auto-tag), `youtube` (auto-tag)

Chaque catégorie a : label FR, couleurs (bg/text/border), outline, dot sidebar.

## Flux d'ingestion

1. Note reçue (Telegram webhook, UI desktop, ou YouTube cron)
2. Texte brut sauvegardé immédiatement
3. Si URL Twitter → fetch tweet text via API v2 (fallback oEmbed), auto-tag `twitter`
4. IA en parallèle : classification (1-3 catégories) + réécriture
5. Note mise à jour avec résultats IA

## YouTube Auto-Sync

- **Cron** : `GET /api/cron/youtube` tous les jours à 9h (Vercel Cron Hobby, `vercel.json`)
- **Sync manuelle** : `POST /api/youtube/sync` (depuis la console : `fetch('/api/youtube/sync',{method:'POST'}).then(r=>r.json()).then(console.log)`)
- Récupère les vidéos d'une playlist YouTube (YouTube Data API v3)
- Skip les doublons (vérifie `links` en base)
- Récupère la transcription via **Supadata API** (`SUPADATA_API_KEY`) — nécessaire car YouTube bloque les IPs datacenter (AWS/Cloudflare) pour les transcriptions
- Résumé IA structuré avec `summarizeYouTubeVideo` (points clés + conclusion, texte direct sans JSON)
- Classification IA automatique + auto-tag `youtube`
- Si pas de transcription (Supadata retourne 202) → note créée avec titre + lien + message d'indisponibilité
- **Limite** : max 3 vidéos/run pour le cron (timeout 60s), toutes les vidéos pour la sync manuelle
- **Important** : `maxDuration = 60` requis sur les deux routes sinon timeout à 10s

## Auth

- Mot de passe simple → cookie `brayn_auth` (30j, httpOnly, secure en prod)
- Middleware skip en dev + routes publiques : `/login`, `/api/auth`, `/api/bot`, `/api/notes/ingest`

## Variables d'environnement

| Variable | Usage |
|----------|-------|
| NEXT_PUBLIC_SUPABASE_URL | URL Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Clé anonyme Supabase |
| SUPABASE_SERVICE_ROLE_KEY | Clé service role |
| GROQ_API_KEY | API Groq pour l'IA |
| TWITTER_BEARER_TOKEN | Twitter API v2 |
| TELEGRAM_BOT_TOKEN | Token bot Telegram |
| TELEGRAM_SECRET_TOKEN | Validation webhook |
| YOUTUBE_API_KEY | Google YouTube Data API v3 |
| YOUTUBE_PLAYLIST_ID | ID playlist à surveiller |
| CRON_SECRET | Sécurité cron Vercel |
| APP_PASSWORD | Mot de passe de connexion |
| NEXT_PUBLIC_APP_URL | URL de l'app |
| SUPADATA_API_KEY | API Supadata pour transcriptions YouTube (bypass IP datacenter) |

## Commandes

```bash
npm run dev      # Serveur dev (port 3000)
npm run build    # Build production
npm run lint     # ESLint
```

## Conventions

- **Langue UI** : Français
- **Thème** : Dark (bg-[#191919], text-[#D4D4D4])
- **IA** : Groq avec llama-3.3-70b-versatile — `summarizeYouTubeVideo` retourne du texte direct (pas JSON), `classifyNote`/`rewriteNote` retournent du JSON parsé
- **API** : Next.js Route Handlers, pas de contrôleurs séparés
- **État** : useState React, pas de state manager externe
- **Polling** : Toutes les 15s pour les nouvelles notes Telegram

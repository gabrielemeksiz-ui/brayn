# YouTube Playlist Auto-Sync — Design Spec

## Objectif

Importer automatiquement (toutes les heures) les vidéos ajoutées à une playlist YouTube dédiée, créer une note par vidéo avec le titre comme nom de note, et générer un résumé structuré (points clés + conclusion) via l'IA.

## Architecture

### Cron Endpoint

- Route : `GET /api/cron/youtube`
- Déclenchement : Vercel Cron toutes les heures (`0 * * * *`)
- Sécurité : vérification `Authorization: Bearer CRON_SECRET`

### Flux

1. Appeler YouTube Data API v3 pour lister les vidéos de la playlist
2. Pour chaque vidéo, vérifier si une note avec cette URL YouTube existe déjà (champ `links`)
3. Pour chaque nouvelle vidéo :
   a. Créer la note : `original_text` = titre de la vidéo, `source` = "youtube", `links` = [URL YouTube]
   b. Récupérer la transcription via `youtube-transcript`
   c. Si transcription dispo : générer un résumé structuré via Groq → stocker dans `full_text`
   d. Si pas de transcription : `full_text` = lien + "Transcription indisponible"
   e. Classifier la note (IA) + auto-tag "youtube"

### Format de la note

- **Titre** (`original_text`) : Nom de la vidéo YouTube (tel quel)
- **Contenu** (`full_text`) :

```
🔗 https://youtube.com/watch?v=VIDEO_ID

### Points clés
- Point 1
- Point 2
- ...

### Conclusion
Phrase de synthèse.
```

- Si pas de transcription :

```
🔗 https://youtube.com/watch?v=VIDEO_ID

⚠️ Transcription indisponible pour cette vidéo.
```

### Détection des doublons

On stocke l'URL YouTube dans le champ `links` (array). Avant import, on query : `links` contient `https://youtube.com/watch?v=VIDEO_ID`. Pas de table supplémentaire.

### Nouvelle catégorie

- Slug : `youtube`
- Label : `YouTube`
- Couleur : rouge (#FF0000) style
- Auto-tagging : toujours ajouté aux notes YouTube (comme Twitter)

### Résumé IA (nouvelle fonction `summarizeYouTubeVideo`)

- Input : transcription complète de la vidéo
- Model : Groq llama-3.3-70b-versatile
- Output : résumé structuré en français (points clés + conclusion)
- max_tokens : 2048 (vidéos longues = résumés plus longs)

### Variables d'environnement

- `YOUTUBE_API_KEY` : clé API Google (YouTube Data API v3)
- `YOUTUBE_PLAYLIST_ID` : ID de la playlist à surveiller
- `CRON_SECRET` : secret pour sécuriser le endpoint cron

### Gestion des erreurs

- API YouTube en erreur → log + retry au prochain cron
- Transcription indisponible → note créée avec mention
- Groq en erreur → note créée avec titre, résumé vide
- Vidéo déjà importée → skip silencieux

### Fichiers à créer/modifier

1. **Créer** `src/app/api/cron/youtube/route.ts` — endpoint cron
2. **Modifier** `src/lib/ai.ts` — ajouter `summarizeYouTubeVideo()`
3. **Modifier** `src/lib/types.ts` — ajouter catégorie `youtube` + source `youtube`
4. **Créer** `vercel.json` — configuration du cron job
5. **Modifier** `.env.local` — ajouter les 3 variables

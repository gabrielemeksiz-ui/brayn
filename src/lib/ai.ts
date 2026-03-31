import OpenAI from 'openai';
import type { AIClassificationResponse, AIRewriteResponse, NoteCategory } from './types';

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

function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export async function classifyNote(
  originalText: string,
  allCategories: { id: string; label: string; ai_description: string }[],
  fewShotBlock?: string,
): Promise<AIClassificationResponse> {
  const allCategoryIds = allCategories.map(c => c.id);

  const categoryList = allCategories
    .map(c => `- ${c.id} : ${c.ai_description || c.label}`)
    .join('\n');

  const response = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
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
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  const raw = parseJSON<{ categories: string[]; confiance: number; explication: string }>(text);

  const categories = (raw.categories ?? []).filter((c): c is NoteCategory =>
    allCategoryIds.includes(c)
  );

  return { categories };
}

export async function summarizeYouTubeVideo(transcript: string, videoTitle: string): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Tu es un assistant de prise de notes pour Brayn, une app de second cerveau. On te donne la transcription complète d'une vidéo YouTube.

Ta mission : créer un résumé structuré en français de cette vidéo.

Format EXACT à respecter (pas de JSON, juste du texte formaté) :

### Points clés
- Point clé 1
- Point clé 2
- Point clé 3
(autant de points que nécessaire pour couvrir les idées principales, entre 3 et 10 points)

### Conclusion
Une phrase de synthèse qui résume l'essentiel de la vidéo.

Règles :
- Écris en français, même si la vidéo est en anglais
- Sois concis mais complet : chaque point clé doit capturer une idée importante
- Ne mets PAS le titre de la vidéo (il est déjà dans le titre de la note)
- Ne mets PAS de lien (il est déjà ajouté automatiquement)
- Commence directement par "### Points clés"

Titre de la vidéo : ${videoTitle}

Transcription :
${transcript.slice(0, 12000)}`,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}

export async function rewriteNote(originalText: string): Promise<AIRewriteResponse> {
  const response = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Tu es un assistant de reformulation pour Brayn, une app de second cerveau. L'utilisateur t'envoie une note brute (souvent une idée rapide, un mémo vocal retranscrit, ou une pensée incomplète).

Ta mission : réécris cette note en français, sous forme d'une ou deux phrases complètes, claires et bien formulées. Développe légèrement l'idée si elle est trop elliptique, mais reste fidèle à l'intention originale. Pas de bullet points. Pas d'intro. Juste la phrase(s) directement.

Réponds UNIQUEMENT avec du JSON valide :
{"clean_original_language": "..."}

Note brute :
${originalText}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  return parseJSON<AIRewriteResponse>(text);
}


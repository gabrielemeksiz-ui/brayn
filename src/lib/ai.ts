import Anthropic from '@anthropic-ai/sdk';
import type { AIClassificationResponse, AIRewriteResponse, NoteCategory } from './types';
import { ALL_CATEGORIES } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export async function classifyNote(originalText: string): Promise<AIClassificationResponse> {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Tu es un assistant de classification. Analyse ce texte et classe-le dans 1 à 3 catégories parmi cette liste UNIQUEMENT : ${ALL_CATEGORIES.join(', ')}.

Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après :
{"categories": ["cat1", "cat2"]}

Texte à analyser :
${originalText}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const result = parseJSON<AIClassificationResponse>(text);

  // Valider que les catégories sont dans la liste autorisée
  result.categories = result.categories.filter((c): c is NoteCategory =>
    ALL_CATEGORIES.includes(c as NoteCategory)
  );

  return result;
}

export async function rewriteNote(originalText: string): Promise<AIRewriteResponse> {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Tu es un assistant d'écriture. Pour ce texte :
1. Détecte la langue principale (FR ou EN).
2. Écris une version propre, concise et corrigée dans cette même langue (clean_original_language).
3. Traduis fidèlement dans l'autre langue (clean_other_language).
Ne rajoute aucune idée. Corrige l'orthographe, grammaire, ponctuation.

Réponds UNIQUEMENT avec du JSON valide :
{"clean_original_language": "...", "clean_other_language": "..."}

Texte :
${originalText}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseJSON<AIRewriteResponse>(text);
}
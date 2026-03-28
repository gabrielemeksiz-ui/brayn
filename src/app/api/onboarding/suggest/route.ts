import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { profile, interests, existingCategoryIds } = await req.json();

  if (!profile || !interests?.length) {
    return NextResponse.json({ error: 'Missing profile or interests' }, { status: 400 });
  }

  const existing = (existingCategoryIds ?? []).join(', ') || 'aucune';

  const prompt = `Tu es l'assistant de configuration de Brayn, app de prise de notes intelligente.
L'utilisateur a le profil "${profile}" et s'intéresse à : ${interests.join(', ')}.
Il a déjà ces catégories : ${existing}.

Propose exactement 3 à 5 catégories SUPPLÉMENTAIRES pertinentes pour cet utilisateur.
Ne répète AUCUNE catégorie existante.

Pour chaque catégorie, retourne un JSON strict :
[
  {
    "id": "slug_en_snake_case",
    "label": "Nom court en français",
    "emoji": "un seul emoji pertinent",
    "color": "code hex couleur (#XXXXXX)",
    "description": "1 phrase courte pour l'UI",
    "ai_description": "Description détaillée pour le classificateur IA (2-3 phrases, avec des exemples de notes qui iraient dans cette catégorie)"
  }
]

Contraintes :
- IDs en snake_case, pas d'accents, pas de majuscules
- Couleurs variées, pas de doublons avec les catégories existantes
- Descriptions ai_description très précises pour éviter les erreurs de classification
- Catégories utiles et actionnables, pas génériques

SORTIE JSON STRICT (rien d'autre, pas de backticks, pas de texte avant/après).`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const suggestions = JSON.parse(cleaned);

    return NextResponse.json(suggestions);
  } catch (err) {
    console.error('AI suggestion error:', err);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}

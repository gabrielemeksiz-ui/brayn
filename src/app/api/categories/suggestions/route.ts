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

  const { data: feedbacks } = await supabase
    .from('classification_feedback')
    .select('ai_categories, user_categories, feedback_type, original_text')
    .eq('user_id', user.id)
    .gte('created_at', thirtyDaysAgo);

  if (!feedbacks || feedbacks.length === 0) {
    return NextResponse.json([]);
  }

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

  // Generate suggestions for categories with >30% error rate and enough data
  const suggestions: CategorySuggestion[] = [];

  for (const cat of categories) {
    const stats = catStats[cat.id];
    if (!stats || stats.total < 3) continue;

    const errorRate = stats.corrections / stats.total;
    if (errorRate <= 0.3) continue;

    try {
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

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

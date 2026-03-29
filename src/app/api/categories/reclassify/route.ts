import { NextRequest } from 'next/server';
import { getSupabaseUserClient, getSupabaseServiceClient } from '@/lib/supabase';
import { classifyNote } from '@/lib/ai';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json();
  const mode: 'all' | 'uncategorized' = body.mode ?? 'all';

  const { data: dbCategories } = await supabase
    .from('categories')
    .select('id, label, ai_description')
    .eq('user_id', user.id)
    .eq('hidden', false);

  const allCategories = dbCategories ?? [];

  const { data: allNotes, error } = await supabase
    .from('notes')
    .select('id, original_text, clean_original_language, source, categories')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const noteList = mode === 'uncategorized'
    ? (allNotes ?? []).filter(n => !n.categories || n.categories.length === 0)
    : (allNotes ?? []);

  const total = noteList.length;

  if (total === 0) {
    return new Response(JSON.stringify({ ok: true, total: 0, processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceSupabase = getSupabaseServiceClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', total })}\n\n`));

      let processed = 0;
      let errors = 0;

      for (const note of noteList) {
        const textForAI = note.clean_original_language || note.original_text || '';

        if (!textForAI.trim()) {
          processed++;
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'skip', processed, total, noteId: note.id, reason: 'empty' })}\n\n`
          ));
          continue;
        }

        try {
          const result = await classifyNote(textForAI, allCategories);
          let newCategories = result.categories as string[];

          const existingCats = note.categories ?? [];
          if (existingCats.includes('twitter') && !newCategories.includes('twitter')) {
            newCategories = ['twitter', ...newCategories];
          }
          if (existingCats.includes('youtube') && !newCategories.includes('youtube')) {
            newCategories = ['youtube', ...newCategories];
          }

          await serviceSupabase
            .from('notes')
            .update({ categories: newCategories })
            .eq('id', note.id);

          processed++;
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'progress',
              processed,
              total,
              noteId: note.id,
              preview: textForAI.slice(0, 80),
              categories: newCategories,
            })}\n\n`
          ));
        } catch (err) {
          processed++;
          errors++;
          console.error(`Reclassify failed for note ${note.id}:`, err);
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              processed,
              total,
              noteId: note.id,
              error: String(err),
            })}\n\n`
          ));
        }
      }

      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'done', total, processed, errors })}\n\n`
      ));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

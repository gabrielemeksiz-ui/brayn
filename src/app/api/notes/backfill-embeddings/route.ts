import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { generateEmbedding, buildEmbeddingText } from '@/lib/embeddings';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, original_text, clean_original_language, full_text')
      .is('embedding', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let processed = 0;
    let failed = 0;

    for (const note of notes ?? []) {
      try {
        const text = buildEmbeddingText(note);
        if (!text.trim()) continue;

        const embedding = await generateEmbedding(text);
        await supabase
          .from('notes')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', note.id);
        processed++;
      } catch (err) {
        console.error(`Failed to embed note ${note.id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      failed,
      total: notes?.length ?? 0,
      message: (notes?.length ?? 0) - processed - failed > 0
        ? 'Run again to process more notes'
        : 'All notes in this batch processed',
    });
  } catch (err) {
    console.error('Error in POST /api/notes/backfill-embeddings:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

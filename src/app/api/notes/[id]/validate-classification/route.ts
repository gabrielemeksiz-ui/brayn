import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data } = await supabase
    .from('classification_feedback')
    .select('feedback_type')
    .eq('note_id', id)
    .single();

  if (!data) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing note id' }, { status: 400 });

  const { data: note, error: fetchError } = await supabase
    .from('notes')
    .select('original_text, categories, ai_categories')
    .eq('id', id)
    .single();

  if (fetchError || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const aiCats = (note.ai_categories as string[]) ?? [];
  if (aiCats.length === 0) {
    return NextResponse.json({ error: 'Note has no AI classification to validate' }, { status: 400 });
  }

  await supabase.rpc('upsert_classification_feedback', {
    p_note_id: id,
    p_user_id: user.id,
    p_original_text: (note.original_text as string) ?? '',
    p_ai_categories: aiCats,
    p_user_categories: (note.categories as string[]) ?? [],
    p_feedback_type: 'explicit_validation',
  });

  return NextResponse.json({ ok: true });
}

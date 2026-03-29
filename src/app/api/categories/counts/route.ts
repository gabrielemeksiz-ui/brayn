import { NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET() {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: notes, error } = await supabase
    .from('notes')
    .select('categories')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  (notes ?? []).forEach(note => {
    (note.categories ?? []).forEach((catId: string) => {
      counts[catId] = (counts[catId] || 0) + 1;
    });
  });

  return NextResponse.json(counts);
}

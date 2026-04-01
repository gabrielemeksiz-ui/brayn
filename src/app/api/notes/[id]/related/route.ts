import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: noteId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 30);

    const { data, error } = await supabase.rpc('find_related_notes', {
      p_note_id: noteId,
      p_user_id: user.id,
      p_limit: limit,
      p_threshold: 0.3,
    });

    if (error) {
      console.error('Related notes error:', error);
      return NextResponse.json({ error: 'Failed to find related notes' }, { status: 500 });
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/notes/[id]/related:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

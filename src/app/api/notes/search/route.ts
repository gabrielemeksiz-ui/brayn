import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    if (!q || !q.trim()) {
      return NextResponse.json([], { status: 200 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

    const { data, error } = await supabase.rpc('search_notes', {
      search_query: q,
      p_user_id: user.id,
      p_limit: limit,
    });

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/notes/search:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

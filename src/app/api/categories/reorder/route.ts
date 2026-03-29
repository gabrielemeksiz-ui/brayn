import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order } = await req.json();

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'Invalid body: expected { order: [...] }' }, { status: 400 });
  }

  const results = await Promise.all(
    order.map(({ id, sort_order }: { id: string; sort_order: number }) =>
      supabase
        .from('categories')
        .update({ sort_order })
        .eq('id', id)
        .eq('user_id', user.id)
    )
  );

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].error!.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

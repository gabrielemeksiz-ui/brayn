import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient, getSupabaseServiceClient } from '@/lib/supabase';
import type { Category } from '@/lib/types';

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check onboarding not already done
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (profile?.onboarding_completed) {
    return NextResponse.json({ error: 'Onboarding already completed' }, { status: 400 });
  }

  const { categories } = await req.json() as { categories: Category[] };

  if (!Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json({ error: 'No categories provided' }, { status: 400 });
  }

  const rows = categories.map((c, i) => ({
    id: c.id,
    label: c.label,
    description: c.description ?? '',
    ai_description: c.ai_description ?? '',
    emoji: c.emoji ?? '📌',
    color: c.color ?? '#6B7280',
    sort_order: i,
    is_builtin: false,
    hidden: false,
    user_id: user.id,
  }));

  const { error: insertError } = await supabase
    .from('categories')
    .upsert(rows, { onConflict: 'id,user_id' });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const serviceClient = getSupabaseServiceClient();
  const { error: profileError } = await serviceClient
    .from('user_profiles')
    .update({ onboarding_completed: true })
    .eq('user_id', user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

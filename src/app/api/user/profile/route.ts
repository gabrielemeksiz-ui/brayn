import { NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET() {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, is_admin, created_at, onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

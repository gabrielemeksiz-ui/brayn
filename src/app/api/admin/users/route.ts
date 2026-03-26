import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getSupabaseServiceClient } from '@/lib/supabase';

export async function GET() {
  const userClient = await getSupabaseUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: { users } } = await supabase.auth.admin.listUsers();

  // Get all used invite codes to match users
  const { data: codes } = await supabase
    .from('invitation_codes')
    .select('code, used_by')
    .not('used_by', 'is', null);

  const codeByUser: Record<string, string> = {};
  for (const c of codes ?? []) {
    if (c.used_by) codeByUser[c.used_by] = c.code;
  }

  const result = (users ?? []).map((u) => ({
    email: u.email ?? null,
    invite_code: codeByUser[u.id] ?? null,
    created_at: u.created_at,
  }));

  return NextResponse.json(result);
}

import { NextResponse } from 'next/server';
import { getSupabaseUserClient, getSupabaseServiceClient } from '@/lib/supabase';

async function getAdminOrFail() {
  const userClient = await getSupabaseUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabase = getSupabaseServiceClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  return { user, error: null };
}

export async function GET() {
  const { user, error } = await getAdminOrFail();
  if (error) return error;

  const supabase = getSupabaseServiceClient();
  const { data: codes } = await supabase
    .from('invitation_codes')
    .select('code, use_count, max_uses, created_at, used_at, used_by')
    .order('created_at', { ascending: false });

  if (!codes) return NextResponse.json([]);

  // Fetch emails for used codes
  const result = await Promise.all(
    codes.map(async (c) => {
      let used_by_email: string | null = null;
      if (c.used_by) {
        const { data } = await supabase.auth.admin.getUserById(c.used_by);
        used_by_email = data?.user?.email ?? null;
      }
      return {
        code: c.code,
        use_count: c.use_count,
        max_uses: c.max_uses,
        created_at: c.created_at,
        used_at: c.used_at,
        used_by_email,
      };
    })
  );

  return NextResponse.json(result);
}

export async function POST() {
  const { user, error } = await getAdminOrFail();
  if (error) return error;

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const code = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  const supabase = getSupabaseServiceClient();
  const { error: insertError } = await supabase
    .from('invitation_codes')
    .insert({ code, created_by: user!.id, max_uses: 1 });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ code });
}

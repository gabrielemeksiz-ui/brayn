import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabase
    .from('categories')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: cat } = await supabase
    .from('categories')
    .select('id, is_builtin, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  if (cat.is_builtin) return NextResponse.json({ error: 'Cannot delete system category' }, { status: 403 });

  const { error: rpcError } = await supabase.rpc('remove_category_from_notes', {
    category_id: id,
    p_user_id: user.id,
  });

  if (rpcError) {
    console.error('Error removing category from notes:', rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

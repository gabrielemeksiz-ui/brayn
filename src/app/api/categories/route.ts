import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// Upsert — used for custom creates AND built-in overrides (label/description/hidden)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, label, description = '', is_builtin = false, hidden = false } = body;

  if (!id || !label) return NextResponse.json({ error: 'Missing id or label' }, { status: 400 });

  const { data, error } = await supabase
    .from('categories')
    .upsert({ id, label, description, is_builtin, hidden })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

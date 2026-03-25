import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseUserClient } from '@/lib/supabase';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return _client;
}

// GET — historique du chat pour une note
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from('note_chats')
    .select('id, role, content, created_at')
    .eq('note_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — envoyer un message et recevoir une réponse IA
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 });
  }

  // Récupérer la note pour le contexte
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('original_text, clean_original_language, clean_other_language, full_text')
    .eq('id', id)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: 'Note introuvable' }, { status: 404 });
  }

  // Récupérer l'historique existant
  const { data: history } = await supabase
    .from('note_chats')
    .select('role, content')
    .eq('note_id', id)
    .order('created_at', { ascending: true });

  const noteContent =
    note.full_text ??
    note.clean_original_language ??
    note.original_text ??
    '';

  // Insérer le message user en DB
  await supabase.from('note_chats').insert({
    note_id: id,
    role: 'user',
    content: message,
  });

  // Construire les messages pour Groq
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `Tu es un assistant personnel qui aide à réfléchir sur une note. Tu es intelligent, direct et utile.
Voici le contenu de la note :
---
${noteContent}
---
Réponds de façon concise et pertinente. Utilise la même langue que l'utilisateur. Tu peux poser des questions pour approfondir la réflexion.`,
    },
    ...((history ?? []) as { role: 'user' | 'assistant'; content: string }[]).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // Appel Groq
  const response = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages,
  });

  const reply = response.choices[0]?.message?.content ?? 'Désolé, je n\'ai pas pu répondre.';

  // Insérer la réponse IA en DB
  await supabase.from('note_chats').insert({
    note_id: id,
    role: 'assistant',
    content: reply,
  });

  return NextResponse.json({ reply });
}

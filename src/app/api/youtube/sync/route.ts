import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient, getSupabaseServiceClient } from '@/lib/supabase';
import { classifyNote, summarizeYouTubeVideo } from '@/lib/ai';
import { fetchTranscriptViaSupadata } from '@/lib/youtube';

export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  // Verify the user is an admin
  const userClient = await getSupabaseUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServiceClient();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

  if (!apiKey || !playlistId) {
    return NextResponse.json(
      { error: 'Missing YOUTUBE_API_KEY or YOUTUBE_PLAYLIST_ID' },
      { status: 500 }
    );
  }

  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${apiKey}`;
  const playlistRes = await fetch(playlistUrl);
  if (!playlistRes.ok) {
    return NextResponse.json({ error: 'YouTube API request failed' }, { status: 502 });
  }

  const playlistData = await playlistRes.json();
  const items: unknown[] = playlistData.items ?? [];

  let imported = 0, skipped = 0, errors = 0;

  for (const item of items) {
    const snippet = (item as { snippet?: Record<string, unknown> }).snippet;
    const resourceId = snippet?.resourceId as Record<string, string> | undefined;
    const videoId: string = resourceId?.videoId ?? '';
    const title: string = (snippet?.title as string) ?? 'Sans titre';

    if (!videoId) { errors++; continue; }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Duplicate check
    const { data: existing } = await supabase
      .from('notes')
      .select('id')
      .contains('links', [videoUrl])
      .limit(1);

    if (existing && existing.length > 0) { skipped++; continue; }

    // Fetch transcript via Supadata
    let rawTranscript = '';
    try {
      rawTranscript = await fetchTranscriptViaSupadata(videoId);
    } catch (err) {
      console.error(`Supadata failed for ${videoId}:`, String(err));
    }

    // AI summary
    let summary: string | null = null;
    if (rawTranscript) {
      try {
        summary = await summarizeYouTubeVideo(rawTranscript, title);
      } catch (err) {
        console.error(`Summary failed for ${videoId}:`, String(err));
      }
    }

    // AI classification
    let categories = ['youtube'];
    try {
      const { data: dbCategories } = await supabase
        .from('categories')
        .select('id, label, ai_description')
        .eq('user_id', user.id)
        .eq('hidden', false);

      const classifyResult = await classifyNote(
        rawTranscript ? `${title}\n\n${rawTranscript.slice(0, 2000)}` : title,
        dbCategories ?? []
      );

      const cats = classifyResult.categories as string[];
      if (!cats.includes('youtube')) cats.unshift('youtube');
      categories = cats;
    } catch (err) {
      console.error(`Classification failed for ${videoId}:`, String(err));
    }

    // Insert note
    try {
      const fullText = rawTranscript
        ? `🔗 ${videoUrl}\n\n${summary ?? rawTranscript.slice(0, 12000)}`
        : `🔗 ${videoUrl}\n\n⚠️ Transcription indisponible pour cette vidéo.`;

      await supabase.from('notes').insert({
        original_text: title,
        clean_original_language: summary,
        full_text: fullText,
        links: [videoUrl],
        categories,
        source: 'youtube',
        seen: false,
        user_id: user.id,
      });
      imported++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ ok: true, imported, skipped, errors });
}

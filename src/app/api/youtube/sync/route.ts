import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase';
import { summarizeVideo } from '@/lib/ai';
import { YoutubeTranscript } from 'youtube-transcript';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_PLAYLIST_ID = process.env.YOUTUBE_PLAYLIST_ID;

export async function POST(_req: NextRequest) {
  if (!YOUTUBE_API_KEY || !YOUTUBE_PLAYLIST_ID) {
    return NextResponse.json(
      { error: 'Missing YOUTUBE_API_KEY or YOUTUBE_PLAYLIST_ID' },
      { status: 500 }
    );
  }

  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_PLAYLIST_ID}&maxResults=50&key=${YOUTUBE_API_KEY}`;
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
    const description: string = (snippet?.description as string) ?? '';

    if (!videoId) { errors++; continue; }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Duplicate check via links array
    const { data: existing } = await supabase
      .from('notes')
      .select('id')
      .contains('links', [videoUrl])
      .limit(1);

    if (existing && existing.length > 0) { skipped++; continue; }

    // Fetch transcript (fallback to description)
    let rawTranscript = '';
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      rawTranscript = segments.map((s: { text: string }) => s.text).join(' ');
    } catch {
      rawTranscript = description;
    }

    // AI summary
    let summary: string | null = null;
    try {
      const result = await summarizeVideo(rawTranscript, title);
      summary = result.summary;
    } catch { /* note créée sans résumé */ }

    // Insert note
    try {
      const truncatedTranscript = rawTranscript.length > 50000
        ? rawTranscript.slice(0, 50000)
        : rawTranscript;

      await supabase.from('notes').insert({
        original_text: title,
        clean_original_language: summary,
        full_text: truncatedTranscript || null,
        links: [videoUrl],
        categories: ['youtube'],
        source: 'desktop',
        seen: false,
      });
      imported++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ ok: true, imported, skipped, errors });
}

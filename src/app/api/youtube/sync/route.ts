import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase';
import { summarizeVideo } from '@/lib/ai';

// PRIMARY: Supadata API — works from datacenter IPs (uses residential proxies)
// Sign up free at supadata.ai, add SUPADATA_API_KEY to Vercel env vars
async function fetchTranscriptViaSupadata(videoId: string): Promise<string> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("SUPADATA_API_KEY not set");

  const res = await fetch(
    `https://api.supadata.ai/v1/transcript?url=https://youtu.be/${videoId}`,
    { headers: { "x-api-key": apiKey } }
  );

  if (!res.ok) throw new Error(`Supadata error ${res.status}: ${await res.text()}`);

  const data = await res.json() as { content: Array<{ text: string }> | string; lang?: string };

  if (typeof data.content === "string") return data.content;
  if (!Array.isArray(data.content) || !data.content.length) throw new Error("Supadata returned empty content");
  return data.content.map((item) => item.text).join(" ").trim();
}

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

    // Fetch transcript via Supadata (works from datacenter IPs)
    let rawTranscript = '';
    try {
      rawTranscript = await fetchTranscriptViaSupadata(videoId);
      console.log(`Transcript fetched via Supadata for ${videoId} (${rawTranscript.length} chars)`);
    } catch (err) {
      console.error(`Supadata failed for ${videoId}:`, String(err));
    }

    // AI summary (only if we have a real transcript)
    let summary: string | null = null;
    if (rawTranscript) {
      try {
        const result = await summarizeVideo(rawTranscript, title);
        summary = result.summary;
      } catch { /* note créée sans résumé */ }
    }

    // Insert note
    try {
      const truncatedTranscript = rawTranscript.length > 50000
        ? rawTranscript.slice(0, 50000)
        : rawTranscript;

      const fullText = rawTranscript
        ? `🔗 ${videoUrl}\n\n${summary ?? truncatedTranscript}`
        : `🔗 ${videoUrl}\n\n⚠️ Transcription indisponible pour cette vidéo.`;

      await supabase.from('notes').insert({
        original_text: title,
        clean_original_language: summary,
        full_text: fullText,
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

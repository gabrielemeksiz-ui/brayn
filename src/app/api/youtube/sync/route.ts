import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase';
import { summarizeVideo } from '@/lib/ai';
import { YoutubeTranscript } from 'youtube-transcript';

async function fetchTranscriptViaWeb(videoId: string): Promise<string> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "X-YouTube-Client-Name": "1",
      "X-YouTube-Client-Version": "2.20240101.00.00",
    },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00" } },
      videoId,
    }),
  });
  const data = await res.json();
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) throw new Error("No caption tracks in WEB response");
  const captionRes = await fetch(tracks[0].baseUrl + "&fmt=json3");
  const captionData = await captionRes.json();
  return (captionData?.events ?? [])
    .filter((e: { segs?: { utf8: string }[] }) => e.segs)
    .flatMap((e: { segs: { utf8: string }[] }) => e.segs.map((s) => s.utf8))
    .join(" ")
    .replace(/\n/g, " ")
    .trim();
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

    // Fetch transcript (library first, then WEB client fallback)
    let rawTranscript = '';
    for (const config of [undefined, { lang: 'fr' }, { lang: 'en' }]) {
      try {
        const segments = await YoutubeTranscript.fetchTranscript(videoId, config);
        rawTranscript = segments.map((s: { text: string }) => s.text).join(' ');
        console.log(`Transcript fetched for ${videoId}: ${segments.length} segments`);
        break;
      } catch (err) {
        console.error(`Transcript fetch failed for ${videoId} (lang=${JSON.stringify(config)}):`, String(err));
      }
    }
    if (!rawTranscript) {
      try {
        rawTranscript = await fetchTranscriptViaWeb(videoId);
        console.log(`Transcript fetched via WEB fallback for ${videoId}`);
      } catch (err) {
        console.error(`WEB fallback also failed for ${videoId}:`, String(err));
      }
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

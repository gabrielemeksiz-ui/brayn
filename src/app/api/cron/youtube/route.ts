import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase";
import { classifyNote, summarizeYouTubeVideo } from "@/lib/ai";
import { YoutubeTranscript } from "youtube-transcript";

// Fallback: Android InnerTube with API key (works from Vercel datacenter IPs)
async function fetchTranscriptViaAndroid(videoId: string): Promise<string> {
  const res = await fetch(
    "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
        "X-Goog-Api-Key": "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 34,
            hl: "fr",
            gl: "FR",
          },
        },
        videoId,
      }),
    }
  );
  const data = await res.json();
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) throw new Error("No caption tracks");
  const xml = await (await fetch(tracks[0].baseUrl)).text();
  return [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) =>
      m[1]
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
    )
    .join(" ")
    .trim();
}

export const maxDuration = 60;

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/playlistItems";

interface YouTubePlaylistItem {
  snippet: {
    title: string;
    resourceId: {
      videoId: string;
    };
  };
}

interface YouTubeAPIResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}

async function fetchPlaylistVideos(): Promise<
  { videoId: string; title: string }[]
> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

  if (!apiKey || !playlistId) {
    throw new Error("Missing YOUTUBE_API_KEY or YOUTUBE_PLAYLIST_ID");
  }

  const videos: { videoId: string; title: string }[] = [];
  let pageToken: string | undefined;

  // Paginate through all playlist items
  do {
    const url = new URL(YOUTUBE_API_URL);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`YouTube API error ${res.status}: ${errText}`);
    }

    const data: YouTubeAPIResponse = await res.json();

    for (const item of data.items) {
      videos.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return videos;
}

async function isVideoAlreadyImported(videoId: string): Promise<boolean> {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const { data } = await supabase
    .from("notes")
    .select("id")
    .contains("links", [youtubeUrl])
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function processVideo(videoId: string, title: string) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 1. Create the note immediately with title and link
  const { data: note, error: insertError } = await supabase
    .from("notes")
    .insert({
      original_text: title,
      source: "youtube",
      seen: false,
      links: [youtubeUrl],
      categories: ["youtube"],
    })
    .select()
    .single();

  if (insertError || !note) {
    console.error(`Failed to create note for video ${videoId}:`, insertError);
    return;
  }

  // 2. Try to get transcript (library first, then WEB client fallback)
  let transcript = "";
  for (const config of [undefined, { lang: 'fr' }, { lang: 'en' }]) {
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, config);
      transcript = transcriptItems.map((item) => item.text).join(" ");
      console.log(`Transcript fetched for ${videoId}: ${transcriptItems.length} segments`);
      break;
    } catch (err) {
      console.error(`Transcript fetch failed for ${videoId} (lang=${JSON.stringify(config)}):`, String(err));
    }
  }
  if (!transcript) {
    try {
      transcript = await fetchTranscriptViaAndroid(videoId);
      console.log(`Transcript fetched via Android+key fallback for ${videoId}`);
    } catch (err) {
      console.error(`Android+key fallback also failed for ${videoId}:`, String(err));
    }
  }

  // 3. Build note content
  const updates: Record<string, unknown> = {};

  if (transcript) {
    // Generate AI summary
    try {
      const summary = await summarizeYouTubeVideo(transcript, title);
      updates.full_text = `\u{1F517} ${youtubeUrl}\n\n${summary}`;
    } catch (err) {
      console.error(`AI summary failed for video ${videoId}:`, err);
      updates.full_text = `\u{1F517} ${youtubeUrl}\n\n\u26A0\uFE0F Erreur lors de la g\u00E9n\u00E9ration du r\u00E9sum\u00E9.`;
    }
  } else {
    updates.full_text = `\u{1F517} ${youtubeUrl}\n\n\u26A0\uFE0F Transcription indisponible pour cette vid\u00E9o.`;
  }

  // 4. Classify with AI (adds categories on top of "youtube")
  try {
    const { data: dbCategories } = await supabase
      .from("categories")
      .select("id, label, description")
      .eq("is_builtin", false)
      .eq("hidden", false);

    const classifyResult = await classifyNote(
      transcript ? `${title}\n\n${transcript.slice(0, 2000)}` : title,
      dbCategories ?? [],
    );

    const cats = classifyResult.categories as string[];
    if (!cats.includes("youtube")) {
      cats.unshift("youtube");
    }
    updates.categories = cats;
  } catch (err) {
    console.error(`Classification failed for video ${videoId}:`, err);
    // Keep default ["youtube"] category
  }

  // 5. Also set clean_original_language to the title
  updates.clean_original_language = title;

  // 6. Update the note
  const { error: updateError } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", note.id);

  if (updateError) {
    console.error(`Failed to update note ${note.id}:`, updateError);
  } else {
    console.log(`Successfully imported: "${title}"`);
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("YouTube sync started...");

    // 1. Fetch all videos from the playlist
    const videos = await fetchPlaylistVideos();
    console.log(`Found ${videos.length} videos in playlist`);

    let imported = 0;
    let skipped = 0;
    const MAX_PER_RUN = 3;

    // 2. Process each video (max 3 per run to stay within 60s timeout)
    for (const video of videos) {
      if (imported >= MAX_PER_RUN) break;
      const alreadyImported = await isVideoAlreadyImported(video.videoId);

      if (alreadyImported) {
        skipped++;
        continue;
      }

      await processVideo(video.videoId, video.title);
      imported++;
    }

    console.log(
      `YouTube sync done: ${imported} imported, ${skipped} skipped`,
    );

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      total: videos.length,
    });
  } catch (err) {
    console.error("YouTube sync error:", err);
    return NextResponse.json(
      { error: "YouTube sync failed", details: String(err) },
      { status: 500 },
    );
  }
}

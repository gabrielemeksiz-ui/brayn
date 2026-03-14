import { NextRequest, NextResponse } from 'next/server';

function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}

function cleanTweetText(text: string): string {
  return text
    .replace(/\s*(https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/g, '')
    .trim();
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  const cleanUrl = url.split('?')[0];
  const tweetId = extractTweetId(cleanUrl);
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  // Use Twitter API v2 if Bearer Token is available — returns full text
  if (tweetId && bearerToken) {
    try {
      const res = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text&expansions=author_id&user.fields=name,username`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
          next: { revalidate: 3600 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const tweet = data.data;
        const author = data.includes?.users?.[0];
        if (tweet?.text) {
          return NextResponse.json({
            authorName: author?.name ?? '',
            authorHandle: author?.username ?? '',
            text: cleanTweetText(tweet.text),
            url: cleanUrl,
          });
        }
      }
    } catch {
      // Fall through to oEmbed fallback
    }
  }

  // Fallback: oEmbed (truncated but no auth required)
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}&dnt=true&omit_script=true`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });

    const data = await res.json();
    const textMatch = data.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const rawText = textMatch?.[1] ?? '';
    const text = cleanTweetText(
      rawText
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    );
    const handle = data.author_url?.split('/').pop() ?? '';

    return NextResponse.json({
      authorName: data.author_name ?? '',
      authorHandle: handle,
      text,
      url: cleanUrl,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tweet' }, { status: 500 });
  }
}

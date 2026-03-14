import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  const cleanUrl = url.split('?')[0];

  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}&dnt=true&omit_script=true`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });

    const data = await res.json();

    // Extract tweet text from oEmbed HTML (<p> inside blockquote)
    const textMatch = data.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const rawText = textMatch?.[1] ?? '';
    // Strip HTML tags from tweet text
    const text = rawText.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

    // Extract handle from author_url
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

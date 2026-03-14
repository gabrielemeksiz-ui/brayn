import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  // Strip query params for Twitter oEmbed compatibility
  const cleanUrl = url.split('?')[0];

  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}&theme=dark&dnt=true&omit_script=false`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });
    const data = await res.json();
    return NextResponse.json({ html: data.html });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tweet' }, { status: 500 });
  }
}

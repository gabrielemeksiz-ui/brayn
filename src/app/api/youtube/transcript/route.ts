// Edge runtime = runs on Cloudflare network, not AWS datacenter
// YouTube does not block Cloudflare IPs the same way it blocks AWS IPs
export const runtime = 'edge';

function parseXmlTranscript(xml: string): string {
  return [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) =>
      m[1]
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
    )
    .join(' ')
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  if (!videoId) {
    return Response.json({ error: 'Missing videoId' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'CONSENT=YES+42',
      },
    });

    const html = await res.text();
    const match = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"audioTracks"/);
    if (!match) {
      return Response.json({ error: 'No captionTracks in page' }, { status: 404 });
    }

    const tracks: Array<{ baseUrl: string; languageCode: string }> = JSON.parse(match[1]);
    if (!tracks.length) {
      return Response.json({ error: 'Empty captionTracks' }, { status: 404 });
    }

    const track =
      tracks.find((t) => t.languageCode === 'fr') ??
      tracks.find((t) => t.languageCode === 'en') ??
      tracks[0];

    const xml = await (await fetch(track.baseUrl)).text();
    const transcript = parseXmlTranscript(xml);

    return Response.json({ transcript, lang: track.languageCode });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

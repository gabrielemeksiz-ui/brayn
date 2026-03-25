// Supadata API — works from datacenter IPs (uses residential proxies)
// Sign up free at supadata.ai, add SUPADATA_API_KEY to Vercel env vars
export async function fetchTranscriptViaSupadata(videoId: string): Promise<string> {
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

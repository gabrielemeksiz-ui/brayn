import OpenAI from 'openai';

// Jina AI — free tier 1M tokens/month, OpenAI SDK compatible, 1024 dims
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://api.jina.ai/v1',
      apiKey: process.env.JINA_API_KEY,
    });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.slice(0, 8000);
  const response = await getClient().embeddings.create({
    model: 'jina-embeddings-v3',
    input,
  });
  return response.data[0].embedding;
}

export function buildEmbeddingText(note: {
  original_text: string | null;
  clean_original_language?: string | null;
  full_text?: string | null;
}): string {
  const parts = [
    note.original_text ?? '',
    note.clean_original_language ?? '',
    note.full_text ?? '',
  ].filter(Boolean);
  return parts.join('\n').slice(0, 8000);
}

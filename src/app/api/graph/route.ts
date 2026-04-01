import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const threshold = parseFloat(searchParams.get('threshold') ?? '0.4');

    // Get edges from similarity function
    const { data: edges, error: edgesError } = await supabase.rpc('get_graph_data', {
      p_user_id: user.id,
      p_similarity_threshold: threshold,
    });

    if (edgesError) {
      console.error('Graph edges error:', edgesError);
      return NextResponse.json({ error: 'Failed to get graph data' }, { status: 500 });
    }

    // Get all notes with embeddings for nodes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, original_text, clean_original_language, categories, created_at')
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Graph nodes error:', notesError);
      return NextResponse.json({ error: 'Failed to get graph nodes' }, { status: 500 });
    }

    // Also add edges for notes sharing 2+ categories
    const categoryEdges: { source_id: string; target_id: string; similarity: number }[] = [];
    const notesArr = notes ?? [];
    for (let i = 0; i < notesArr.length; i++) {
      for (let j = i + 1; j < notesArr.length; j++) {
        const shared = (notesArr[i].categories ?? []).filter(
          (c: string) => (notesArr[j].categories ?? []).includes(c)
        );
        if (shared.length >= 2) {
          const alreadyExists = (edges ?? []).some(
            (e: { source_id: string; target_id: string }) =>
              (e.source_id === notesArr[i].id && e.target_id === notesArr[j].id) ||
              (e.source_id === notesArr[j].id && e.target_id === notesArr[i].id)
          );
          if (!alreadyExists) {
            categoryEdges.push({
              source_id: notesArr[i].id,
              target_id: notesArr[j].id,
              similarity: 0.2 + shared.length * 0.1,
            });
          }
        }
      }
    }

    return NextResponse.json({
      nodes: notesArr.map(n => ({
        id: n.id,
        original_text: n.original_text,
        clean_original_language: n.clean_original_language,
        categories: n.categories,
        created_at: n.created_at,
      })),
      edges: [
        ...(edges ?? []).map((e: { source_id: string; target_id: string; similarity: number }) => ({
          source: e.source_id,
          target: e.target_id,
          similarity: e.similarity,
        })),
        ...categoryEdges.map(e => ({
          source: e.source_id,
          target: e.target_id,
          similarity: e.similarity,
        })),
      ],
    }, { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/graph:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

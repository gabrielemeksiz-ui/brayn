import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { classifyNote, rewriteNote } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const body = await req.json();

    const noteId = body?.note_id as string | undefined;

    // ── Flow B: classify an existing desktop note ──────────────────────────
    if (noteId) {
      const { data: existingNote, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (fetchError || !existingNote) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      const text = existingNote.original_text as string;
      const userId = existingNote.user_id as string;

      // Mark as processing
      await supabase
        .from('notes')
        .update({ ai_status: 'processing' })
        .eq('id', noteId);

      // Load custom categories
      const { data: dbCategories } = await supabase
        .from('categories')
        .select('id, label, description')
        .eq('user_id', userId)
        .eq('is_builtin', false)
        .eq('hidden', false);

      const customCategories = dbCategories ?? [];

      const [classifyResult, rewriteResult] = await Promise.allSettled([
        classifyNote(text, customCategories),
        rewriteNote(text),
      ]);

      const updates: Record<string, unknown> = { ai_status: 'done' };

      if (classifyResult.status === 'fulfilled') {
        updates.categories = classifyResult.value.categories;
      }
      if (rewriteResult.status === 'fulfilled') {
        updates.clean_original_language = rewriteResult.value.clean_original_language;
      }
      if (classifyResult.status === 'rejected' && rewriteResult.status === 'rejected') {
        updates.ai_status = 'failed';
      }

      const { data: updated, error: updateError } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', noteId)
        .select()
        .single();

      if (updateError) {
        await supabase.from('notes').update({ ai_status: 'failed' }).eq('id', noteId);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, note: updated }, { status: 200 });
    }

    // ── Flow A: create + classify new note (Telegram / YouTube) ───────────
    const text = body?.text as string | undefined;
    const source = (body?.source as string | undefined) ?? "telegram";
    const userId = body?.user_id as string | undefined;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({ original_text: text, source, seen: false, user_id: userId, ai_status: 'processing' })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error in /api/notes/ingest:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: dbCategories } = await supabase
      .from("categories")
      .select("id, label, description")
      .eq("user_id", userId)
      .eq("is_builtin", false)
      .eq("hidden", false);

    const customCategories = dbCategories ?? [];

    const tweetUrlMatch = text.trim().match(/^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i);
    let tweetTitle: string | null = null;
    let tweetFullText: string | null = null;

    if (tweetUrlMatch) {
      try {
        const cleanUrl = text.trim().split('?')[0];
        const tweetIdMatch = cleanUrl.match(/\/status\/(\d+)/);
        const tweetId = tweetIdMatch?.[1];
        const bearerToken = process.env.TWITTER_BEARER_TOKEN;
        let cleanedText = '';

        if (tweetId && bearerToken) {
          const v2Res = await fetch(
            `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text`,
            { headers: { Authorization: `Bearer ${bearerToken}` } },
          );
          if (v2Res.ok) {
            const v2Data = await v2Res.json();
            if (v2Data.data?.text) {
              cleanedText = v2Data.data.text
                .replace(/\s*(https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/g, '')
                .trim();
            }
          }
        }

        if (!cleanedText) {
          const oembedRes = await fetch(
            `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}&dnt=true&omit_script=true`,
          );
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            const pMatch = oembedData.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            const rawText = pMatch?.[1] ?? '';
            cleanedText = rawText
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
              .replace(/\s*(https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/g, '')
              .trim();
          }
        }

        if (cleanedText) {
          tweetFullText = cleanedText;
          const words = cleanedText.split(/\s+/);
          tweetTitle = words.length > 15 ? words.slice(0, 15).join(' ') + '…' : cleanedText;
        }
      } catch {
        // Ignore — title will fall back to URL
      }
    }

    const [classifyResult, rewriteResult] = await Promise.allSettled([
      classifyNote(tweetTitle ?? text, customCategories),
      tweetTitle
        ? Promise.resolve({ clean_original_language: tweetTitle })
        : rewriteNote(text),
    ]);

    const updates: Record<string, unknown> = { ai_status: 'done' };

    if (classifyResult.status === 'fulfilled') {
      const cats = classifyResult.value.categories as string[];
      if (tweetUrlMatch && !cats.includes('twitter')) cats.unshift('twitter');
      updates.categories = cats;
    } else if (tweetUrlMatch) {
      updates.categories = ['twitter'];
    }
    if (rewriteResult.status === 'fulfilled') {
      updates.clean_original_language = rewriteResult.value.clean_original_language;
    }
    if (tweetFullText) {
      updates.full_text = tweetFullText;
    }
    if (classifyResult.status === 'rejected' && rewriteResult.status === 'rejected') {
      updates.ai_status = 'failed';
    }

    if (Object.keys(updates).length === 1 && updates.ai_status === 'done') {
      return NextResponse.json({ ok: true, note: data }, { status: 200 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("notes")
      .update(updates)
      .eq("id", data.id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update note with AI results:", updateError);
      return NextResponse.json({ ok: true, note: data }, { status: 200 });
    }

    return NextResponse.json({ ok: true, note: updated }, { status: 200 });
  } catch (err) {
    console.error('Error in /api/notes/ingest', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

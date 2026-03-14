import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase";
import { classifyNote, rewriteNote } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const text = body?.text as string | undefined;
    const source = (body?.source as string | undefined) ?? "telegram";

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    // 1. Insérer d'abord — le texte brut est toujours préservé même si l'IA échoue
    const { data, error } = await supabase
      .from("notes")
      .insert({ original_text: text, source, seen: false })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error in /api/notes/ingest:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Charger les catégories custom depuis la DB pour le prompt IA
    const { data: dbCategories } = await supabase
      .from("categories")
      .select("id, label, description")
      .eq("is_builtin", false)
      .eq("hidden", false);

    const customCategories = dbCategories ?? [];

    // Detect if the note is a Twitter/X URL — fetch tweet text for title
    const tweetUrlMatch = text.trim().match(/^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i);
    let tweetTitle: string | null = null;
    let tweetFullText: string | null = null;
    if (tweetUrlMatch) {
      try {
        const cleanUrl = text.trim().split('?')[0];
        const oembedRes = await fetch(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}&dnt=true&omit_script=true`
        );
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          const pMatch = oembedData.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/);
          const rawText = pMatch?.[1] ?? '';
          const cleanedText = rawText
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
            .replace(/\s*(https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/g, '')
            .trim();
          tweetFullText = cleanedText;
          const words = cleanedText.split(/\s+/);
          tweetTitle = words.length > 15 ? words.slice(0, 15).join(' ') + '…' : cleanedText;
        }
      } catch {
        // Ignore — title will fall back to URL
      }
    }

    // 3. Lancer classification + réécriture en parallèle
    const [classifyResult, rewriteResult] = await Promise.allSettled([
      classifyNote(tweetTitle ?? text, customCategories),
      tweetTitle
        ? Promise.resolve({ clean_original_language: tweetTitle })
        : rewriteNote(text),
    ]);

    if (classifyResult.status === "rejected") {
      console.error("classifyNote failed:", classifyResult.reason);
    }
    if (rewriteResult.status === "rejected") {
      console.error("rewriteNote failed:", rewriteResult.reason);
    }

    // 4. Construire la mise à jour avec les résultats disponibles
    const updates: Record<string, unknown> = {};

    if (classifyResult.status === "fulfilled") {
      updates.categories = classifyResult.value.categories;
    }
    if (rewriteResult.status === "fulfilled") {
      updates.clean_original_language =
        rewriteResult.value.clean_original_language;
    }
    if (tweetFullText) {
      updates.full_text = tweetFullText;
    }

    if (Object.keys(updates).length === 0) {
      // L'IA a échoué mais la note brute est sauvegardée
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
      // On renvoie quand même la note brute
      return NextResponse.json({ ok: true, note: data }, { status: 200 });
    }

    return NextResponse.json({ ok: true, note: updated }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/notes/ingest", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

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

    // 2. Lancer classification + réécriture en parallèle
    const [classifyResult, rewriteResult] = await Promise.allSettled([
      classifyNote(text),
      rewriteNote(text),
    ]);

    if (classifyResult.status === "rejected") {
      console.error("classifyNote failed:", classifyResult.reason);
    }
    if (rewriteResult.status === "rejected") {
      console.error("rewriteNote failed:", rewriteResult.reason);
    }

    // 3. Construire la mise à jour avec les résultats disponibles
    const updates: Record<string, unknown> = {};

    if (classifyResult.status === "fulfilled") {
      updates.categories = classifyResult.value.categories;
    }
    if (rewriteResult.status === "fulfilled") {
      updates.clean_original_language =
        rewriteResult.value.clean_original_language;
      updates.clean_other_language = rewriteResult.value.clean_other_language;
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

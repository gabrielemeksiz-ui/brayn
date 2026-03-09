import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase";


// Types de base pour la note
type NoteSource = "telegram" | "desktop";

interface IngestBody {
  text: string;
  sentAt?: string;
  source?: NoteSource;
}


// Helpers “stub” pour l’IA (à remplacer plus tard par Kimi)
async function classifyCategories(_text: string): Promise<string[]> {
  // TODO: appeler l’API Kimi ici
  return []; // pour l’instant, pas de catégories
}

async function rewriteNote(
  _text: string,
): Promise<{ clean_original_language: string; clean_other_language: string }> {
  // TODO: appeler l’API Kimi ici
  return {
    clean_original_language: _text,
    clean_other_language: _text,
  };
}

// Détection simple des URLs dans un texte
function extractLinks(text: string): string[] {
  const urlRegex =
    /https?:\/\/[^\s)]+/gi;
  return text.match(urlRegex) ?? [];
}

// Handler POST /api/notes/ingest
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IngestBody;

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "Missing 'text' in body" },
        { status: 400 },
      );
    }

    const source: NoteSource = body.source === "telegram" ? "telegram" : "desktop";
    const sentAt = body.sentAt ? new Date(body.sentAt) : new Date();
    const links = extractLinks(body.text);

    // 1) Créer la note brute dans Supabase
    const { data: inserted, error: insertError } = await supabase
      .from("notes")
      .insert({
        source,
        seen: false,
        categories: [],
        tags: [],
        links,
        original_text: body.text,
        created_at: sentAt.toISOString(),
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("Error inserting note:", insertError);
      return NextResponse.json(
        { error: "Failed to insert note" },
        { status: 500 },
      );
    }

    // 2) Appels IA (stub pour l’instant)
    const [categories, rewritten] = await Promise.all([
      classifyCategories(body.text),
      rewriteNote(body.text),
    ]);

    // 3) Mettre à jour la note avec les résultats IA
    const { data: updated, error: updateError } = await supabase
      .from("notes")
      .update({
        categories,
        clean_original_language: rewritten.clean_original_language,
        clean_other_language: rewritten.clean_other_language,
      })
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("Error updating note with AI fields:", updateError);
      // On renvoie quand même la note insérée
      return NextResponse.json(inserted, { status: 200 });
    }

    // 4) Retourner la note complète
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error in /api/notes/ingest:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

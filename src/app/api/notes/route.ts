import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase";

// POST /api/notes — création directe sans IA
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = (body?.title as string | undefined) ?? "Nouvelle note";
    const source = (body?.source as string | undefined) ?? "desktop";

    const { data, error } = await supabase
      .from("notes")
      .insert({
        original_text: title,
        clean_original_language: title,
        source,
        seen: false,
        categories: [],
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ note: data }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/notes", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}



// GET /api/notes
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const seenParam = searchParams.get("seen");
    const categoryParam = searchParams.get("category");
    const qParam = searchParams.get("q");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    let query = supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });

    // Filtre seen
    if (seenParam === "true") {
      query = query.eq("seen", true);
    } else if (seenParam === "false") {
      query = query.eq("seen", false);
    }

    // Filtre catégorie (notes dont le tableau categories contient cette valeur)
    if (categoryParam) {
      query = query.contains("categories", [categoryParam]);
    }

    // Filtre texte — cherche dans le brut ET la version propre
    if (qParam) {
      const escaped = qParam.replace(/[%_]/g, "\\$&");
      query = query.or(
        `original_text.ilike.%${escaped}%,clean_original_language.ilike.%${escaped}%`,
      );
    }

    // Plage de dates sur created_at
    if (fromParam) {
      query = query.gte("created_at", fromParam);
    }
    if (toParam) {
      // on ajoute 1 jour pour inclure la date to
      const toDate = new Date(toParam);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lte("created_at", toDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notes:", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 },
      );
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/notes:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

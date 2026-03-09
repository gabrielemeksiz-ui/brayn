import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase";



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

    // Filtre texte (simple LIKE sur original_text)
    if (qParam) {
      query = query.ilike("original_text", `%${qParam}%`);
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

// src/app/api/notes/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const text = body?.text as string | undefined;
    const source = (body?.source as string | undefined) ?? "telegram";

    if (!text) {
      return NextResponse.json(
        { error: "Missing text" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({
        original_text: text,
        source,
        seen: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error in /api/notes/ingest:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, note: data },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/notes/ingest", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

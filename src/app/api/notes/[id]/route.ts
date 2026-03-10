// @ts-nocheck

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  // ⬅ on attend la Promise de params (pattern Next 16)
  const { id } = await props.params;
  console.log("PATCH /api/notes/[id] id =", id);

  if (!id) {
    return NextResponse.json(
      { error: "Missing note id" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("notes")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating note", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

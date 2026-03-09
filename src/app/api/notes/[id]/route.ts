// @ts-nocheck

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(_req, context) {
  const supabase = getSupabaseServerClient();
  const id = context.params.id;

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching note by id", error);
    return NextResponse.json(
      { error: "Failed to fetch note" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function PATCH(req, context) {
  const supabase = getSupabaseServerClient();
  const id = context.params.id;
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
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(_req, context) {
  const supabase = getSupabaseServerClient();
  const id = context.params.id;

  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) {
    console.error("Error deleting note", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

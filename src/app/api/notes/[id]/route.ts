import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "seen",
  "categories",
  "full_text",
  "original_text",
  "clean_original_language",
  "ai_status",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 });
    }

    const body = await req.json();

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("notes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error in PATCH /api/notes/[id]:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // --- Classification feedback capture ---
    if (data) {
      const aiCats = (data.ai_categories as string[]) ?? [];

      // Signal A: Category correction
      if ('categories' in updates && aiCats.length > 0) {
        const userCats = (updates.categories as string[]) ?? [];
        const sorted = (arr: string[]) => [...arr].sort();
        const arraysEqual = JSON.stringify(sorted(aiCats)) === JSON.stringify(sorted(userCats));
        const feedbackType = arraysEqual ? 'explicit_validation' : 'correction';

        await supabase.rpc('upsert_classification_feedback', {
          p_note_id: id,
          p_user_id: user.id,
          p_original_text: (data.original_text as string) ?? '',
          p_ai_categories: aiCats,
          p_user_categories: userCats,
          p_feedback_type: feedbackType,
        });
      }

      // Signal B: Implicit validation on seen
      if ('seen' in updates && updates.seen === true && aiCats.length > 0) {
        await supabase.rpc('upsert_classification_feedback', {
          p_note_id: id,
          p_user_id: user.id,
          p_original_text: (data.original_text as string) ?? '',
          p_ai_categories: aiCats,
          p_user_categories: aiCats,
          p_feedback_type: 'implicit_validation',
        });
      }
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Error in PATCH /api/notes/[id]", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await getSupabaseUserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing note id" }, { status: 400 });

    // Supprimer l'historique chat lié
    await supabase.from("note_chats").delete().eq("note_id", id);

    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error in DELETE /api/notes/[id]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

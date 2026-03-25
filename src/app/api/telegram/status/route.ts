import { NextResponse } from "next/server";
import { getSupabaseUserClient, getSupabaseServiceClient } from "@/lib/supabase";

// GET /api/telegram/status — vérifie si l'utilisateur a lié son compte Telegram
export async function GET() {
  try {
    const userClient = await getSupabaseUserClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceClient = getSupabaseServiceClient();

    const { data: telegramUser } = await serviceClient
      .from("telegram_users")
      .select("telegram_chat_id, created_at")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      linked: !!telegramUser,
      chat_id: telegramUser?.telegram_chat_id ?? null,
      linked_at: telegramUser?.created_at ?? null,
    });
  } catch (err) {
    console.error("Error in GET /api/telegram/status", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/telegram/status — délier le compte Telegram
export async function DELETE() {
  try {
    const userClient = await getSupabaseUserClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceClient = getSupabaseServiceClient();
    await serviceClient.from("telegram_users").delete().eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error in DELETE /api/telegram/status", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

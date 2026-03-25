import { NextResponse } from "next/server";
import { getSupabaseUserClient, getSupabaseServiceClient } from "@/lib/supabase";

// POST /api/telegram/link-code — génère un code de liaison Telegram (expire 10min)
export async function POST() {
  try {
    const userClient = await getSupabaseUserClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Générer un code 8 caractères alphanumérique
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const serviceClient = getSupabaseServiceClient();

    // Supprimer les anciens codes de cet utilisateur
    await serviceClient.from("telegram_link_codes").delete().eq("user_id", user.id);

    // Insérer le nouveau code
    const { error } = await serviceClient.from("telegram_link_codes").insert({
      code,
      user_id: user.id,
      expires_at: expiresAt,
    });

    if (error) {
      console.error("Failed to create link code:", error);
      return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
    }

    return NextResponse.json({ code, expires_at: expiresAt });
  } catch (err) {
    console.error("Error in POST /api/telegram/link-code", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

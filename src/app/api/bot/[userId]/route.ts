import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = getSupabaseServiceClient();

  // Récupérer le bot token de cet utilisateur
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("bot_token")
    .eq("user_id", userId)
    .single();

  if (!profile?.bot_token) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 404 });
  }

  const botToken = profile.bot_token;

  // Lire le JSON envoyé par Telegram
  const update = await req.json();
  const message = update?.message?.text as string | undefined;
  const chatId = update?.message?.chat?.id as number | undefined;

  if (!message || !chatId) {
    return NextResponse.json({ ok: true });
  }

  const sendMessage = async (text: string) => {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  };

  // Appeler l'API d'ingestion avec le user_id
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/notes/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        source: "telegram",
        user_id: userId,
      }),
    });

    if (res.ok) {
      await sendMessage("✅ Note sauvegardée dans Brayn !");
    } else {
      const errorBody = await res.text();
      console.error("Error calling /api/notes/ingest", res.status, errorBody);
      await sendMessage("❌ Erreur lors de la sauvegarde. Réessaie.");
    }
  } catch (err) {
    console.error("Failed to call /api/notes/ingest", err);
    await sendMessage("❌ Erreur de connexion. Réessaie.");
  }

  return NextResponse.json({ ok: true });
}

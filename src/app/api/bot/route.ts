// src/app/api/bot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_SECRET_TOKEN;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!secret || !botToken) {
    console.error("Telegram env vars missing");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 1) Vérifier que la requête vient bien de Telegram (secret)
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Lire le JSON envoyé par Telegram
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

  const supabase = getSupabaseServiceClient();

  // 3) Commande /link <code> — lier le compte Telegram
  const linkMatch = message.trim().match(/^\/link\s+([A-Z0-9]{8})$/i);
  if (linkMatch) {
    const code = linkMatch[1].toUpperCase();

    const { data: linkCode } = await supabase
      .from("telegram_link_codes")
      .select("user_id, expires_at")
      .eq("code", code)
      .single();

    if (!linkCode) {
      await sendMessage("❌ Code invalide ou expiré. Génère un nouveau code depuis l'app.");
      return NextResponse.json({ ok: true });
    }

    if (new Date(linkCode.expires_at) < new Date()) {
      await sendMessage("❌ Ce code a expiré. Génère un nouveau code depuis l'app.");
      return NextResponse.json({ ok: true });
    }

    // Upsert the telegram_users link
    const { error } = await supabase
      .from("telegram_users")
      .upsert({ telegram_chat_id: String(chatId), user_id: linkCode.user_id }, { onConflict: "telegram_chat_id" });

    // Delete used code
    await supabase.from("telegram_link_codes").delete().eq("code", code);

    if (error) {
      console.error("Failed to link Telegram user:", error);
      await sendMessage("❌ Erreur lors de la liaison. Réessaie.");
    } else {
      await sendMessage("✅ Compte lié avec succès ! Tes prochains messages seront sauvegardés dans Brayn.");
    }

    return NextResponse.json({ ok: true });
  }

  // 4) Trouver l'utilisateur lié à ce chat Telegram
  const { data: telegramUser } = await supabase
    .from("telegram_users")
    .select("user_id")
    .eq("telegram_chat_id", String(chatId))
    .single();

  if (!telegramUser) {
    await sendMessage("👋 Bienvenue sur Brayn ! Pour lier ton compte, génère un code depuis les paramètres de l'app et envoie /link <code>.");
    return NextResponse.json({ ok: true });
  }

  // 5) Appeler l'API d'ingestion avec le user_id
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/notes/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        source: "telegram",
        user_id: telegramUser.user_id,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Error calling /api/notes/ingest", res.status, errorBody);
    }
  } catch (err) {
    console.error("Failed to call /api/notes/ingest", err);
  }

  return NextResponse.json({ ok: true });
}

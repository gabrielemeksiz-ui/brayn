// src/app/api/bot/route.ts
import { NextRequest, NextResponse } from "next/server";

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

  // Si ce n’est pas un message texte, on ignore
  if (!message || !chatId) {
    return NextResponse.json({ ok: true });
  }

  // 3) Appeler l’API d’ingestion pour créer la note
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/notes/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        source: "telegram",
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Error calling /api/notes/ingest", res.status, errorBody);
    }
  } catch (err) {
    console.error("Failed to call /api/notes/ingest", err);
  }

  // 4) Répondre à Telegram “OK, j’ai reçu”
  return NextResponse.json({ ok: true });
}

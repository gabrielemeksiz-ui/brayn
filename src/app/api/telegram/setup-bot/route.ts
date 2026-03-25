import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserClient, getSupabaseServiceClient } from "@/lib/supabase";

// GET — statut du bot de l'utilisateur connecté
export async function GET() {
  try {
    const userClient = await getSupabaseUserClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseServiceClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("bot_username")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      configured: !!profile?.bot_username,
      bot_username: profile?.bot_username ?? null,
    });
  } catch (err) {
    console.error("Error in GET /api/telegram/setup-bot", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST — configurer un bot (valide le token, set le webhook, sauvegarde)
export async function POST(req: NextRequest) {
  try {
    const userClient = await getSupabaseUserClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await req.json();
    if (!token?.trim()) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 });
    }

    const cleanToken = token.trim();

    // 1. Valider le token via Telegram API
    const meRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const meData = await meRes.json();

    if (!meData.ok) {
      return NextResponse.json(
        { error: "Token invalide — vérifie que tu as bien copié le token depuis BotFather." },
        { status: 400 }
      );
    }

    const botUsername = meData.result.username as string;

    // 2. Configurer le webhook vers /api/bot/[userId]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: "APP_URL non configurée" }, { status: 500 });
    }

    const webhookUrl = `${appUrl}/api/bot/${user.id}`;
    const webhookRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const webhookData = await webhookRes.json();

    if (!webhookData.ok) {
      return NextResponse.json(
        { error: "Impossible de configurer le webhook. Réessaie." },
        { status: 500 }
      );
    }

    // 3. Sauvegarder en DB
    const supabase = getSupabaseServiceClient();
    await supabase
      .from("user_profiles")
      .update({ bot_token: cleanToken, bot_username: botUsername })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, bot_username: botUsername });
  } catch (err) {
    console.error("Error in POST /api/telegram/setup-bot", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE — supprimer le bot
export async function DELETE() {
  try {
    const userClient = await getSupabaseUserClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseServiceClient();

    // Récupérer le token pour supprimer le webhook
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("bot_token")
      .eq("user_id", user.id)
      .single();

    if (profile?.bot_token) {
      await fetch(`https://api.telegram.org/bot${profile.bot_token}/deleteWebhook`);
    }

    await supabase
      .from("user_profiles")
      .update({ bot_token: null, bot_username: null })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error in DELETE /api/telegram/setup-bot", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

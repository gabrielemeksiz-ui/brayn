import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email, password, inviteCode } = await req.json();

    if (!email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "Email, mot de passe et code d'invitation requis" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Validate invitation code
    const { data: invite, error: inviteError } = await supabase
      .from("invitation_codes")
      .select("*")
      .eq("code", inviteCode)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Code d'invitation invalide" },
        { status: 400 }
      );
    }

    if (invite.use_count >= invite.max_uses) {
      return NextResponse.json(
        { error: "Code d'invitation déjà utilisé" },
        { status: 400 }
      );
    }

    // Create user via Supabase Auth Admin API
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Erreur lors de la création du compte" },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Create user profile (onboarding_completed defaults to false)
    await supabase
      .from("user_profiles")
      .insert({ user_id: userId, is_admin: false });

    // Mark invitation code as used
    await supabase
      .from("invitation_codes")
      .update({
        used_by: userId,
        used_at: new Date().toISOString(),
        use_count: invite.use_count + 1,
      })
      .eq("code", inviteCode);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500 }
    );
  }
}

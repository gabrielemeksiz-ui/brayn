"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div
      className="h-screen bg-[#191919] flex items-center justify-center"
      style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}
    >
      <div className="w-full max-w-[360px] px-8">
        <div className="mb-8 text-center">
          <div className="text-3xl mb-3">🧠</div>
          <h1 className="text-[18px] font-medium text-[#D4D4D4] mb-1">Brayn</h1>
          <p className="text-[13px] text-[#9B9B9B]">Connectez-vous pour accéder</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoFocus
            className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-4 py-2.5 text-[14px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#ffcbd0]/50 transition-colors duration-100"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-4 py-2.5 text-[14px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#ffcbd0]/50 transition-colors duration-100"
          />

          {error && <p className="text-red-400 text-[13px] text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] hover:opacity-90 text-[#571c27] font-medium rounded-[4px] py-2.5 text-[14px] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#606060] mt-4">
          Pas de compte ?{" "}
          <a href="/signup" className="text-[#ffcbd0] hover:underline">
            S'inscrire
          </a>
        </p>
      </div>
    </div>
  );
}

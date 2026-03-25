"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, inviteCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Erreur lors de l'inscription");
      setLoading(false);
      return;
    }

    // Redirect to login after successful signup
    router.push("/login");
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
          <p className="text-[13px] text-[#9B9B9B]">Créer un compte avec un code d'invitation</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoFocus
            className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-4 py-2.5 text-[14px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-4 py-2.5 text-[14px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100"
          />

          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Code d'invitation"
            className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-4 py-2.5 text-[14px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100"
          />

          {error && <p className="text-red-400 text-[13px] text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password || !inviteCode}
            className="w-full bg-[#2E7CD1] hover:bg-[#2568B8] text-white font-medium rounded-[4px] py-2.5 text-[14px] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Création..." : "Créer un compte"}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#606060] mt-4">
          Déjà un compte ?{" "}
          <a href="/login" className="text-[#2E7CD1] hover:underline">
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}

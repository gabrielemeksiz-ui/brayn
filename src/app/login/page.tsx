"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Mot de passe incorrect");
      setLoading(false);
    }
  }

  return (
    <div className="h-screen bg-[#191919] flex items-center justify-center" style={{fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)"}}>
      <div className="w-full max-w-[360px] px-8">
        <div className="mb-8 text-center">
          <div className="text-3xl mb-3">🧠</div>
          <h1 className="text-[18px] font-medium text-[#D4D4D4] mb-1">Brayn</h1>
          <p className="text-[13px] text-[#9B9B9B]">Entrez votre mot de passe pour accéder</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            autoFocus
            className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-4 py-2.5 text-[14px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100"
          />

          {error && (
            <p className="text-red-400 text-[13px] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[#2E7CD1] hover:bg-[#2568B8] text-white font-medium rounded-[4px] py-2.5 text-[14px] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Vérification…" : "Accéder"}
          </button>
        </form>
      </div>
    </div>
  );
}

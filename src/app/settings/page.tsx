'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface TelegramStatus {
  linked: boolean;
  chat_id: string | null;
  linked_at: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkCodeExpiry, setLinkCodeExpiry] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/telegram/status')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setTelegramStatus(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/telegram/link-code', { method: 'POST' });
      const data = await res.json();
      if (data.code) {
        setLinkCode(data.code);
        setLinkCodeExpiry(data.expires_at);
      }
    } finally {
      setGenerating(false);
    }
  };

  const unlinkTelegram = async () => {
    setUnlinking(true);
    try {
      await fetch('/api/telegram/status', { method: 'DELETE' });
      setTelegramStatus({ linked: false, chat_id: null, linked_at: null });
      setLinkCode(null);
    } finally {
      setUnlinking(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const expiryLabel = linkCodeExpiry
    ? new Date(linkCodeExpiry).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-[#191919] text-[#D4D4D4]" style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}>
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="flex items-center gap-4 mb-8">
          <a
            href="/"
            className="text-[#9B9B9B] hover:text-[#D4D4D4] text-[13px] transition-colors duration-100"
          >
            ← Retour
          </a>
          <h1 className="text-[18px] font-medium">Paramètres</h1>
        </div>

        {/* Telegram section */}
        <section className="bg-[#202020] border border-[#2A2A2A] rounded-[8px] p-5 mb-4">
          <h2 className="text-[15px] font-medium mb-1">Telegram</h2>
          <p className="text-[13px] text-[#9B9B9B] mb-4">
            Lie ton compte Telegram pour envoyer des notes directement depuis le bot.
          </p>

          {loading ? (
            <p className="text-[13px] text-[#606060]">Chargement…</p>
          ) : telegramStatus?.linked ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[13px] text-emerald-300">Compte lié</span>
                {telegramStatus.linked_at && (
                  <span className="text-[12px] text-[#606060]">
                    — depuis le {new Date(telegramStatus.linked_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
              <button
                onClick={unlinkTelegram}
                disabled={unlinking}
                className="text-[13px] text-red-400 hover:text-red-300 transition-colors duration-100 disabled:opacity-40"
              >
                {unlinking ? 'Déliaison…' : 'Délier le compte'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#606060] shrink-0" />
                <span className="text-[13px] text-[#9B9B9B]">Non lié</span>
              </div>

              {linkCode ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#D4D4D4]">
                    Envoie cette commande au bot Telegram :
                  </p>
                  <code className="block bg-[#252525] border border-[#2A2A2A] rounded-[6px] px-4 py-3 text-[15px] font-mono text-[#2E7CD1] tracking-widest select-all">
                    /link {linkCode}
                  </code>
                  {expiryLabel && (
                    <p className="text-[12px] text-[#606060]">Code valide jusqu&apos;à {expiryLabel}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="px-4 py-2 bg-[#2E7CD1] hover:bg-[#2568B8] text-white text-[13px] rounded-[6px] transition-colors duration-100 disabled:opacity-40"
                >
                  {generating ? 'Génération…' : 'Générer un code de liaison'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Compte section */}
        <section className="bg-[#202020] border border-[#2A2A2A] rounded-[8px] p-5">
          <h2 className="text-[15px] font-medium mb-1">Compte</h2>
          <p className="text-[13px] text-[#9B9B9B] mb-4">
            Gérer ta session.
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-[#2A2A2A] hover:bg-[#333] text-[#D4D4D4] text-[13px] rounded-[6px] transition-colors duration-100"
          >
            Déconnexion
          </button>
        </section>
      </div>
    </div>
  );
}

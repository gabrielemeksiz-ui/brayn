'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface TelegramStatus {
  linked: boolean;
  chat_id: string | null;
  linked_at: string | null;
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '';

const STEPS = [
  {
    n: 1,
    title: 'Télécharge Telegram',
    desc: 'Si tu ne l\'as pas encore, télécharge l\'app Telegram sur ton téléphone ou ouvre web.telegram.org.',
    link: { label: 'Télécharger Telegram', href: 'https://telegram.org/apps' },
  },
  {
    n: 2,
    title: 'Ouvre le bot Brayn',
    desc: 'Clique sur le bouton ci-dessous pour ouvrir le bot directement dans Telegram.',
    link: BOT_USERNAME
      ? { label: `Ouvrir @${BOT_USERNAME}`, href: `https://t.me/${BOT_USERNAME}` }
      : null,
  },
  {
    n: 3,
    title: 'Démarre le bot',
    desc: 'Dans Telegram, appuie sur le bouton "Démarrer" (ou envoie /start) pour activer le bot.',
  },
  {
    n: 4,
    title: 'Génère ton code de liaison',
    desc: 'Clique sur le bouton ci-dessous pour obtenir un code unique valable 10 minutes.',
  },
  {
    n: 5,
    title: 'Envoie le code au bot',
    desc: 'Copie la commande générée et envoie-la dans ta conversation avec le bot Telegram.',
  },
  {
    n: 6,
    title: 'C\'est fait !',
    desc: 'Le bot va confirmer la liaison. Désormais, tout message envoyé au bot sera sauvegardé dans Brayn.',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkCodeExpiry, setLinkCodeExpiry] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();
        setIsAdmin(profile?.is_admin ?? false);
      }

      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      if (!data.error) setTelegramStatus(data);
      setLoading(false);
    };
    init();
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

  const copyCommand = async () => {
    if (!linkCode) return;
    await navigator.clipboard.writeText(`/link ${linkCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="text-[#9B9B9B] hover:text-[#D4D4D4] text-[13px] transition-colors duration-100">
            ← Retour
          </a>
          <h1 className="text-[18px] font-medium">Paramètres</h1>
        </div>

        {/* Compte */}
        <section className="bg-[#202020] border border-[#2A2A2A] rounded-[8px] p-5 mb-4">
          <h2 className="text-[15px] font-medium mb-3">Mon compte</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[#D4D4D4]">{email ?? '—'}</p>
              <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                isAdmin
                  ? 'bg-[#2E7CD1]/20 text-[#2E7CD1]'
                  : 'bg-[#2A2A2A] text-[#9B9B9B]'
              }`}>
                {isAdmin ? 'Admin' : 'Invité'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333] text-[#9B9B9B] hover:text-[#D4D4D4] text-[13px] rounded-[6px] transition-colors duration-100"
            >
              Déconnexion
            </button>
          </div>
        </section>

        {/* Telegram */}
        <section className="bg-[#202020] border border-[#2A2A2A] rounded-[8px] p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[15px] font-medium">Telegram</h2>
            {!loading && (
              <span className={`flex items-center gap-1.5 text-[12px] ${telegramStatus?.linked ? 'text-emerald-400' : 'text-[#606060]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${telegramStatus?.linked ? 'bg-emerald-400' : 'bg-[#606060]'}`} />
                {telegramStatus?.linked ? 'Lié' : 'Non lié'}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#9B9B9B] mb-5">
            Envoie tes notes directement depuis Telegram — elles apparaissent instantanément dans Brayn.
          </p>

          {loading ? (
            <p className="text-[13px] text-[#606060]">Chargement…</p>
          ) : telegramStatus?.linked ? (
            /* Déjà lié */
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[6px] px-4 py-3">
                <p className="text-[13px] text-emerald-300 font-medium">✓ Compte Telegram lié avec succès</p>
                {telegramStatus.linked_at && (
                  <p className="text-[12px] text-[#606060] mt-0.5">
                    Depuis le {new Date(telegramStatus.linked_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <p className="text-[13px] text-[#9B9B9B]">
                Tout message envoyé au bot sera automatiquement sauvegardé dans Brayn.
              </p>
              <button
                onClick={unlinkTelegram}
                disabled={unlinking}
                className="text-[12px] text-red-400/70 hover:text-red-400 transition-colors duration-100 disabled:opacity-40"
              >
                {unlinking ? 'Déliaison…' : 'Délier le compte Telegram'}
              </button>
            </div>
          ) : (
            /* Tutoriel étape par étape */
            <div className="space-y-4">
              {STEPS.map((step) => {
                const isStep4 = step.n === 4;
                const isStep5 = step.n === 5;
                const isStep6 = step.n === 6;
                const isStepDone =
                  (isStep4 && linkCode) ||
                  (isStep5 && linkCode) ||
                  isStep6;
                const isActive =
                  (step.n === 1) ||
                  (step.n === 2) ||
                  (step.n === 3) ||
                  (isStep4 && !linkCode) ||
                  (isStep5 && !!linkCode) ||
                  false;

                return (
                  <div
                    key={step.n}
                    className={`flex gap-4 ${isStep6 ? 'opacity-40' : ''}`}
                  >
                    {/* Numéro */}
                    <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                      isActive || isStepDone
                        ? 'bg-[#2E7CD1] text-white'
                        : 'bg-[#2A2A2A] text-[#606060]'
                    }`}>
                      {step.n}
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#D4D4D4] mb-1">{step.title}</p>
                      <p className="text-[13px] text-[#9B9B9B] leading-relaxed">{step.desc}</p>

                      {/* Lien externe */}
                      {step.link && (
                        <a
                          href={step.link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-[13px] text-[#2E7CD1] hover:underline"
                        >
                          {step.link.label} →
                        </a>
                      )}
                      {step.n === 2 && !BOT_USERNAME && (
                        <p className="mt-2 text-[12px] text-[#606060] italic">
                          Recherche le bot dans Telegram — demande le nom à l&apos;admin.
                        </p>
                      )}

                      {/* Étape 4 — générer le code */}
                      {isStep4 && !linkCode && (
                        <button
                          onClick={generateCode}
                          disabled={generating}
                          className="mt-3 px-4 py-2 bg-[#2E7CD1] hover:bg-[#2568B8] text-white text-[13px] rounded-[6px] transition-colors duration-100 disabled:opacity-40"
                        >
                          {generating ? 'Génération…' : 'Générer mon code'}
                        </button>
                      )}

                      {/* Étape 5 — copier et envoyer */}
                      {isStep5 && linkCode && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-[#252525] border border-[#2A2A2A] rounded-[6px] px-3 py-2 text-[14px] font-mono text-[#2E7CD1] tracking-widest">
                              /link {linkCode}
                            </code>
                            <button
                              onClick={copyCommand}
                              className={`px-3 py-2 rounded-[6px] text-[12px] transition-colors duration-100 shrink-0 ${
                                copied
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-[#2A2A2A] hover:bg-[#333] text-[#9B9B9B]'
                              }`}
                            >
                              {copied ? '✓ Copié' : 'Copier'}
                            </button>
                          </div>
                          {expiryLabel && (
                            <p className="text-[12px] text-[#606060]">⏱ Code valide jusqu&apos;à {expiryLabel} — génère-en un nouveau si expiré.</p>
                          )}
                          <button
                            onClick={generateCode}
                            disabled={generating}
                            className="text-[12px] text-[#606060] hover:text-[#9B9B9B] transition-colors duration-100"
                          >
                            Régénérer un code
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

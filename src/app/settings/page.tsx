'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface BotStatus {
  configured: boolean;
  bot_username: string | null;
}

interface InviteCode {
  code: string;
  use_count: number;
  max_uses: number;
  created_at: string;
  used_at: string | null;
  used_by_email: string | null;
}

interface AdminUser {
  email: string | null;
  invite_code: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<HTMLInputElement>(null);

  // Admin state
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);

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
        const admin = profile?.is_admin ?? false;
        setIsAdmin(admin);

        if (admin) {
          const [codesRes, usersRes] = await Promise.all([
            fetch('/api/admin/invite-codes'),
            fetch('/api/admin/users'),
          ]);
          setInviteCodes(await codesRes.json());
          setAdminUsers(await usersRes.json());
        }
      }

      const res = await fetch('/api/telegram/setup-bot');
      const data = await res.json();
      if (!data.error) setBotStatus(data);
      setLoading(false);
    };
    init();
  }, []);

  const generateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/admin/invite-codes', { method: 'POST' });
      if (res.ok) {
        const codesRes = await fetch('/api/admin/invite-codes');
        setInviteCodes(await codesRes.json());
      }
    } finally {
      setGeneratingCode(false);
    }
  };

  const setupBot = async () => {
    if (!tokenInput.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/telegram/setup-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setBotStatus({ configured: true, bot_username: data.bot_username });
        setTokenInput('');
      } else {
        setSaveError(data.error ?? 'Erreur inconnue');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeBot = async () => {
    setRemoving(true);
    try {
      await fetch('/api/telegram/setup-bot', { method: 'DELETE' });
      setBotStatus({ configured: false, bot_username: null });
    } finally {
      setRemoving(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

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
                isAdmin ? 'bg-[#2E7CD1]/20 text-[#2E7CD1]' : 'bg-[#2A2A2A] text-[#9B9B9B]'
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
        <section className="bg-[#202020] border border-[#2A2A2A] rounded-[8px] p-5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[15px] font-medium">Bot Telegram</h2>
            {!loading && (
              <span className={`flex items-center gap-1.5 text-[12px] ${botStatus?.configured ? 'text-emerald-400' : 'text-[#606060]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${botStatus?.configured ? 'bg-emerald-400' : 'bg-[#606060]'}`} />
                {botStatus?.configured ? `@${botStatus.bot_username}` : 'Non configuré'}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#9B9B9B] mb-6">
            Crée ton propre bot Telegram personnel — tout ce que tu lui envoies sera sauvegardé dans Brayn.
          </p>

          {loading ? (
            <p className="text-[13px] text-[#606060]">Chargement…</p>
          ) : botStatus?.configured ? (
            /* Bot déjà configuré */
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[6px] px-4 py-3">
                <p className="text-[13px] text-emerald-300 font-medium">✓ Bot configuré et actif</p>
                <p className="text-[12px] text-[#9B9B9B] mt-0.5">
                  Ouvre <a href={`https://t.me/${botStatus.bot_username}`} target="_blank" rel="noopener noreferrer" className="text-[#2E7CD1] hover:underline">@{botStatus.bot_username}</a> dans Telegram et envoie n'importe quel message pour créer une note.
                </p>
              </div>
              <button
                onClick={removeBot}
                disabled={removing}
                className="text-[12px] text-red-400/70 hover:text-red-400 transition-colors duration-100 disabled:opacity-40"
              >
                {removing ? 'Suppression…' : 'Supprimer le bot'}
              </button>
            </div>
          ) : (
            /* Tutoriel */
            <div className="space-y-5">

              {/* Étape 1 */}
              <Step n={1} title="Ouvre BotFather sur Telegram">
                <p className="text-[13px] text-[#9B9B9B] leading-relaxed">
                  BotFather est le bot officiel Telegram pour créer des bots. Clique sur le lien ci-dessous — ça ouvre directement la conversation.
                </p>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-2 px-3 py-2 bg-[#2E7CD1]/10 border border-[#2E7CD1]/30 rounded-[6px] text-[13px] text-[#2E7CD1] hover:bg-[#2E7CD1]/20 transition-colors duration-100"
                >
                  Ouvrir @BotFather →
                </a>
                <p className="text-[12px] text-[#606060] mt-2">
                  Si Telegram n&apos;est pas installé, télécharge-le d&apos;abord sur <a href="https://telegram.org/apps" target="_blank" rel="noopener noreferrer" className="text-[#2E7CD1] hover:underline">telegram.org</a>.
                </p>
              </Step>

              {/* Étape 2 */}
              <Step n={2} title='Envoie la commande "/newbot"'>
                <p className="text-[13px] text-[#9B9B9B] leading-relaxed">
                  Dans la conversation avec BotFather, envoie ce message :
                </p>
                <CodeBlock value="/newbot" />
              </Step>

              {/* Étape 3 */}
              <Step n={3} title="Donne un nom à ton bot">
                <p className="text-[13px] text-[#9B9B9B] leading-relaxed">
                  BotFather te demande d&apos;abord un <strong className="text-[#D4D4D4]">nom affiché</strong> (ex: <em>Mon Brayn</em>), puis un <strong className="text-[#D4D4D4]">username</strong> qui doit se terminer par <code className="text-[#D4D4D4] bg-[#252525] px-1 rounded">bot</code> (ex: <em>monbrayn_bot</em>).
                </p>
              </Step>

              {/* Étape 4 */}
              <Step n={4} title="Copie le token">
                <p className="text-[13px] text-[#9B9B9B] leading-relaxed">
                  BotFather affiche un message de confirmation avec un <strong className="text-[#D4D4D4]">token</strong> — une longue chaîne de caractères qui ressemble à :
                </p>
                <CodeBlock value="1234567890:ABCdefGHIjklMNOpqrSTUVwxyz" dim />
                <p className="text-[13px] text-[#9B9B9B] mt-2 leading-relaxed">
                  Appuie longuement dessus pour le copier (ou clique sur le token dans l&apos;app desktop).
                </p>
              </Step>

              {/* Étape 5 */}
              <Step n={5} title="Colle le token ici">
                <p className="text-[13px] text-[#9B9B9B] leading-relaxed mb-3">
                  Brayn va vérifier le token et configurer le bot automatiquement — tu n&apos;as rien d&apos;autre à faire.
                </p>
                <div className="flex gap-2">
                  <input
                    ref={tokenRef}
                    type="text"
                    value={tokenInput}
                    onChange={e => { setTokenInput(e.target.value); setSaveError(null); }}
                    placeholder="1234567890:ABCdef…"
                    className="flex-1 bg-[#252525] border border-[#2A2A2A] focus:border-[#2E7CD1] rounded-[6px] px-3 py-2 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none transition-colors duration-100 font-mono"
                  />
                  <button
                    onClick={setupBot}
                    disabled={saving || !tokenInput.trim()}
                    className="px-4 py-2 bg-[#2E7CD1] hover:bg-[#2568B8] text-white text-[13px] rounded-[6px] transition-colors duration-100 disabled:opacity-40 shrink-0"
                  >
                    {saving ? 'Vérification…' : 'Connecter'}
                  </button>
                </div>
                {saveError && (
                  <p className="text-[12px] text-red-400 mt-2">{saveError}</p>
                )}
              </Step>

              {/* Étape 6 */}
              <Step n={6} title="Envoie ta première note !" dim>
                <p className="text-[13px] text-[#9B9B9B] leading-relaxed">
                  Une fois connecté, ouvre ton bot dans Telegram et envoie n'importe quel message — il apparaîtra instantanément dans Brayn.
                </p>
              </Step>

            </div>
          )}
        </section>

        {/* Administration (admin only) */}
        {isAdmin && (
          <section className="bg-[#202020] border border-[#2A2A2A] rounded-[8px] p-5 space-y-6">
            <h2 className="text-[15px] font-medium">Administration</h2>

            {/* Codes d'invitation */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-medium text-[#D4D4D4]">Codes d'invitation</h3>
                <button
                  onClick={generateCode}
                  disabled={generatingCode}
                  className="px-3 py-1.5 bg-[#2E7CD1] hover:bg-[#2568B8] text-white text-[12px] rounded-[6px] transition-colors duration-100 disabled:opacity-40"
                >
                  {generatingCode ? 'Génération…' : '+ Générer un code'}
                </button>
              </div>
              {inviteCodes.length === 0 ? (
                <p className="text-[13px] text-[#606060]">Aucun code pour l'instant.</p>
              ) : (
                <div className="border border-[#2A2A2A] rounded-[6px] overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]">
                        <th className="text-left px-3 py-2 text-[#606060] font-medium">Code</th>
                        <th className="text-left px-3 py-2 text-[#606060] font-medium">Statut</th>
                        <th className="text-left px-3 py-2 text-[#606060] font-medium">Utilisé par</th>
                        <th className="text-left px-3 py-2 text-[#606060] font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inviteCodes.map((c) => {
                        const used = c.use_count >= c.max_uses;
                        return (
                          <tr key={c.code} className="border-b border-[#2A2A2A] last:border-0">
                            <td className="px-3 py-2 font-mono text-[#D4D4D4]">{c.code}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                used ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#2A2A2A] text-[#9B9B9B]'
                              }`}>
                                {used ? 'utilisé' : 'libre'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[#9B9B9B]">{c.used_by_email ?? '—'}</td>
                            <td className="px-3 py-2 text-[#606060]">
                              {c.used_at ? new Date(c.used_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Utilisateurs */}
            <div>
              <h3 className="text-[13px] font-medium text-[#D4D4D4] mb-3">Utilisateurs</h3>
              {adminUsers.length === 0 ? (
                <p className="text-[13px] text-[#606060]">Aucun utilisateur.</p>
              ) : (
                <div className="border border-[#2A2A2A] rounded-[6px] overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]">
                        <th className="text-left px-3 py-2 text-[#606060] font-medium">Email</th>
                        <th className="text-left px-3 py-2 text-[#606060] font-medium">Code utilisé</th>
                        <th className="text-left px-3 py-2 text-[#606060] font-medium">Inscrit le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u, i) => (
                        <tr key={i} className="border-b border-[#2A2A2A] last:border-0">
                          <td className="px-3 py-2 text-[#D4D4D4]">{u.email ?? '—'}</td>
                          <td className="px-3 py-2 font-mono text-[#9B9B9B]">{u.invite_code ?? '—'}</td>
                          <td className="px-3 py-2 text-[#606060]">
                            {new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

function Step({ n, title, children, dim = false }: {
  n: number;
  title: string;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div className={`flex gap-4 ${dim ? 'opacity-40' : ''}`}>
      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5 bg-[#2E7CD1] text-white">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#D4D4D4] mb-1.5">{title}</p>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ value, dim = false }: { value: string; dim?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <code className={`flex-1 bg-[#252525] border border-[#2A2A2A] rounded-[6px] px-3 py-2 text-[13px] font-mono ${dim ? 'text-[#606060]' : 'text-[#D4D4D4]'}`}>
        {value}
      </code>
      <button
        onClick={copy}
        className={`px-3 py-2 rounded-[6px] text-[12px] shrink-0 transition-colors duration-100 ${
          copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#2A2A2A] hover:bg-[#333] text-[#9B9B9B]'
        }`}
      >
        {copied ? '✓' : 'Copier'}
      </button>
    </div>
  );
}

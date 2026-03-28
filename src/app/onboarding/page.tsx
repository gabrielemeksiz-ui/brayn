'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { Category } from '@/lib/types';

const PALETTE = [
  '#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#A855F7',
  '#EC4899', '#06B6D4', '#F97316', '#8B5CF6', '#10B981',
  '#6B7280', '#1D9BF0',
];

const COMMON_EMOJIS = [
  '🚀', '📊', '💡', '🔍', '📝', '🎯', '💬', '📚', '🔧', '🌍',
  '📈', '🤖', '⚡', '🎨', '🧠', '💰', '📣', '🏆', '🔒', '🎬',
  '🐛', '⛓️', '🌱', '🔑', '📂',
];

const INTERESTS_LIST = [
  'finance', 'crypto', 'géopolitique', 'IA / tech', 'marketing',
  'business', 'bien-être', 'musique', 'sport', 'science',
  'art / design', 'voyage', 'food', 'productivité', 'développement personnel',
];

interface Template {
  id: string;
  profile_label: string;
  profile_emoji: string;
  interests: string[];
  categories: Category[];
}

interface EditableCategory extends Category {
  enabled: boolean;
  isAiSuggestion?: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Step 1
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Step 2
  const [editableCategories, setEditableCategories] = useState<EditableCategory[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Step 3
  const [finalCategories, setFinalCategories] = useState<EditableCategory[]>([]);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New category form (step 3)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📌');
  const [newCatColor, setNewCatColor] = useState('#6B7280');

  useEffect(() => {
    async function checkAuth() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      // Check if onboarding already done
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const profile = await res.json();
        if (profile?.onboarding_completed) {
          router.push('/');
          return;
        }
      }
      // Load templates
      const templRes = await fetch('/api/onboarding/templates');
      if (templRes.ok) {
        const data = await templRes.json();
        setTemplates(data);
      }
      setCheckingAuth(false);
    }
    checkAuth();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="h-screen bg-[#191919] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#2E7CD1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedTemplate = templates.find(t => t.id === selectedProfile);

  // ── Step 1 handlers ──────────────────────────────────────────────────────
  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const goToStep2 = () => {
    if (!selectedTemplate) return;
    const cats: EditableCategory[] = selectedTemplate.categories.map(c => ({
      ...c,
      enabled: true,
      is_builtin: false,
      hidden: false,
      sort_order: 0,
    }));
    setEditableCategories(cats);
    setStep(2);
  };

  // ── Step 2 handlers ──────────────────────────────────────────────────────
  const toggleCategory = (id: string) => {
    setEditableCategories(prev =>
      prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
    );
  };

  const generateAISuggestions = async () => {
    if (!selectedProfile) return;
    setIsGenerating(true);
    try {
      const existingIds = editableCategories.map(c => c.id);
      const res = await fetch('/api/onboarding/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: selectedTemplate?.profile_label,
          interests: selectedInterests,
          existingCategoryIds: existingIds,
        }),
      });
      if (res.ok) {
        const suggestions: Category[] = await res.json();
        const aiCats: EditableCategory[] = suggestions.map(c => ({
          ...c,
          enabled: true,
          is_builtin: false,
          hidden: false,
          sort_order: 0,
          isAiSuggestion: true,
        }));
        setEditableCategories(prev => [...prev, ...aiCats]);
      }
    } catch (err) {
      console.error('AI suggestion failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const goToStep3 = () => {
    const active = editableCategories.filter(c => c.enabled);
    setFinalCategories(active);
    setStep(3);
  };

  // ── Step 3 handlers ──────────────────────────────────────────────────────
  const updateFinalCat = (id: string, updates: Partial<EditableCategory>) => {
    setFinalCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeFinalCat = (id: string) => {
    setFinalCategories(prev => prev.filter(c => c.id !== id));
  };

  const addNewCategory = () => {
    if (!newCatLabel.trim()) return;
    const id = newCatLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (finalCategories.find(c => c.id === id)) return;
    const newCat: EditableCategory = {
      id,
      label: newCatLabel,
      emoji: newCatEmoji,
      color: newCatColor,
      description: '',
      ai_description: '',
      is_builtin: false,
      hidden: false,
      sort_order: finalCategories.length,
      enabled: true,
    };
    setFinalCategories(prev => [...prev, newCat]);
    setNewCatLabel('');
    setNewCatEmoji('📌');
    setNewCatColor('#6B7280');
    setShowAddForm(false);
  };

  const completeOnboarding = async () => {
    if (finalCategories.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: finalCategories }),
      });
      if (res.ok) {
        router.push('/');
      }
    } catch (err) {
      console.error('Onboarding complete failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#191919] text-[#D4D4D4]" style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}>
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium transition-all duration-200 ${
                  s < step ? 'bg-[#2E7CD1] text-white' :
                  s === step ? 'bg-[#2E7CD1]/20 border-2 border-[#2E7CD1] text-[#2E7CD1]' :
                  'bg-[#252525] border border-[#2A2A2A] text-[#606060]'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-px ${s < step ? 'bg-[#2E7CD1]' : 'bg-[#2A2A2A]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-[22px] font-semibold text-[#D4D4D4] mb-2">Comment tu utilises tes notes ?</h2>
              <p className="text-[14px] text-[#9B9B9B]">Choisis un profil pour personnaliser tes catégories</p>
            </div>

            {/* Profiles grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedProfile(t.id)}
                  className={`p-4 rounded-[8px] border text-left transition-all duration-150 ${
                    selectedProfile === t.id
                      ? 'border-[#2E7CD1] bg-[#2E7CD1]/10'
                      : 'border-[#2A2A2A] bg-[#252525] hover:border-[#333]'
                  }`}
                >
                  <div className="text-2xl mb-2">{t.profile_emoji}</div>
                  <div className="text-[14px] font-medium text-[#D4D4D4]">{t.profile_label}</div>
                </button>
              ))}
            </div>

            {/* Interests */}
            <div>
              <h3 className="text-[15px] font-medium text-[#D4D4D4] mb-3">Quels sujets t&apos;intéressent ?</h3>
              <div className="flex flex-wrap gap-2">
                {INTERESTS_LIST.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 rounded-full text-[13px] border transition-all duration-150 ${
                      selectedInterests.includes(interest)
                        ? 'border-[#2E7CD1] bg-[#2E7CD1]/15 text-[#2E7CD1]'
                        : 'border-[#2A2A2A] text-[#9B9B9B] hover:border-[#333] hover:text-[#D4D4D4]'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={goToStep2}
              disabled={!selectedProfile || selectedInterests.length < 2}
              className="w-full py-3 rounded-[8px] bg-[#2E7CD1] hover:bg-[#2568B8] text-white font-medium text-[15px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant →
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-[22px] font-semibold text-[#D4D4D4] mb-2">Tes catégories suggérées</h2>
              <p className="text-[14px] text-[#9B9B9B]">Basées sur ton profil de {selectedTemplate?.profile_label}</p>
            </div>

            <div className="space-y-2">
              {editableCategories.map(cat => (
                <div
                  key={cat.id}
                  className={`flex items-center gap-3 p-3 rounded-[8px] border transition-all duration-150 ${
                    cat.enabled ? 'border-[#2A2A2A] bg-[#252525]' : 'border-[#2A2A2A] bg-[#1E1E1E] opacity-50'
                  }`}
                >
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
                      cat.enabled ? 'bg-[#2E7CD1] border-[#2E7CD1]' : 'border-[#444] bg-transparent'
                    }`}
                  >
                    {cat.enabled && <span className="text-white text-[10px]">✓</span>}
                  </button>
                  <div
                    className="w-8 h-8 rounded-[6px] flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${cat.color}25` }}
                  >
                    {cat.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#D4D4D4]">{cat.label}</span>
                      {cat.isAiSuggestion && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[#2E7CD1]/15 text-[#2E7CD1] border border-[#2E7CD1]/30">
                          ✨ IA
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#606060] truncate">{cat.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={generateAISuggestions}
              disabled={isGenerating}
              className="w-full py-2.5 rounded-[8px] border border-[#2A2A2A] bg-[#252525] hover:bg-[#2A2A2A] text-[14px] text-[#9B9B9B] hover:text-[#D4D4D4] transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#2E7CD1] border-t-transparent rounded-full animate-spin" />
                  L&apos;IA analyse tes intérêts…
                </>
              ) : (
                '✨ Générer des suggestions IA'
              )}
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-3 rounded-[8px] border border-[#2A2A2A] text-[#9B9B9B] hover:text-[#D4D4D4] text-[14px] transition-colors duration-150"
              >
                ← Retour
              </button>
              <button
                onClick={goToStep3}
                disabled={editableCategories.filter(c => c.enabled).length === 0}
                className="flex-1 py-3 rounded-[8px] bg-[#2E7CD1] hover:bg-[#2568B8] text-white font-medium text-[15px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-[22px] font-semibold text-[#D4D4D4] mb-2">Personnalise tes catégories</h2>
              <p className="text-[14px] text-[#9B9B9B]">Modifie les noms, émojis et couleurs selon tes préférences</p>
            </div>

            <div className="space-y-3">
              {finalCategories.map(cat => (
                <div key={cat.id} className="p-4 rounded-[8px] border border-[#2A2A2A] bg-[#252525] space-y-3">
                  <div className="flex items-start gap-3">
                    {/* Emoji picker */}
                    <div className="relative">
                      <button
                        onClick={() => setEmojiPickerFor(emojiPickerFor === cat.id ? null : cat.id)}
                        className="w-10 h-10 rounded-[6px] flex items-center justify-center text-xl hover:bg-[#2A2A2A] transition-colors duration-150 border border-[#2A2A2A]"
                        style={{ backgroundColor: `${cat.color}20` }}
                      >
                        {cat.emoji}
                      </button>
                      {emojiPickerFor === cat.id && (
                        <div className="absolute top-12 left-0 z-50 bg-[#252525] border border-[#2A2A2A] rounded-[8px] p-2 grid grid-cols-5 gap-1 shadow-xl">
                          {COMMON_EMOJIS.map(e => (
                            <button
                              key={e}
                              onClick={() => { updateFinalCat(cat.id, { emoji: e }); setEmojiPickerFor(null); }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-[#2A2A2A] rounded text-lg"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Label input */}
                    <input
                      type="text"
                      value={cat.label}
                      onChange={e => updateFinalCat(cat.id, { label: e.target.value })}
                      className="flex-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-[6px] px-3 py-2 text-[14px] text-[#D4D4D4] focus:outline-none focus:border-[#2E7CD1]"
                    />

                    {/* Delete */}
                    <button
                      onClick={() => removeFinalCat(cat.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[#606060] hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 shrink-0 mt-0.5"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Color palette */}
                  <div className="flex gap-2 flex-wrap">
                    {PALETTE.map(hex => (
                      <button
                        key={hex}
                        onClick={() => updateFinalCat(cat.id, { color: hex })}
                        className={`w-6 h-6 rounded-full transition-all duration-150 ${
                          cat.color === hex ? 'ring-2 ring-offset-2 ring-offset-[#252525] ring-white scale-110' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add category form */}
            {showAddForm ? (
              <div className="p-4 rounded-[8px] border border-[#2E7CD1]/30 bg-[#252525] space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const emojis = COMMON_EMOJIS;
                      const i = emojis.indexOf(newCatEmoji);
                      setNewCatEmoji(emojis[(i + 1) % emojis.length]);
                    }}
                    className="w-10 h-10 rounded-[6px] flex items-center justify-center text-xl border border-[#2A2A2A] bg-[#1E1E1E]"
                  >
                    {newCatEmoji}
                  </button>
                  <input
                    type="text"
                    value={newCatLabel}
                    onChange={e => setNewCatLabel(e.target.value)}
                    placeholder="Nom de la catégorie…"
                    className="flex-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-[6px] px-3 py-2 text-[14px] text-[#D4D4D4] focus:outline-none focus:border-[#2E7CD1] placeholder-[#606060]"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PALETTE.map(hex => (
                    <button
                      key={hex}
                      onClick={() => setNewCatColor(hex)}
                      className={`w-6 h-6 rounded-full transition-all duration-150 ${
                        newCatColor === hex ? 'ring-2 ring-offset-2 ring-offset-[#252525] ring-white scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addNewCategory}
                    disabled={!newCatLabel.trim()}
                    className="flex-1 py-2 rounded-[6px] bg-[#2E7CD1] hover:bg-[#2568B8] text-white text-[13px] font-medium transition-colors duration-150 disabled:opacity-40"
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-[6px] border border-[#2A2A2A] text-[#9B9B9B] text-[13px] transition-colors duration-150 hover:text-[#D4D4D4]"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-2.5 rounded-[8px] border border-dashed border-[#2A2A2A] text-[13px] text-[#606060] hover:text-[#9B9B9B] hover:border-[#333] transition-colors duration-150"
              >
                + Ajouter une catégorie
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-3 rounded-[8px] border border-[#2A2A2A] text-[#9B9B9B] hover:text-[#D4D4D4] text-[14px] transition-colors duration-150"
              >
                ← Retour
              </button>
              <button
                onClick={completeOnboarding}
                disabled={isSubmitting || finalCategories.length === 0}
                className="flex-1 py-3 rounded-[8px] bg-[#2E7CD1] hover:bg-[#2568B8] text-white font-medium text-[15px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  'Terminer et commencer 🧠'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

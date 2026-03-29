'use client';

import { useState, useEffect, useCallback } from 'react';

interface Category {
  id: string;
  label: string;
  description: string;
  ai_description: string;
  color: string;
  sort_order: number;
  is_builtin: boolean;
  hidden: boolean;
  user_id?: string;
}

interface CategorySettingsProps {
  onClose: () => void;
  onCategoriesChanged: () => void;
}

export default function CategorySettings({ onClose, onCategoriesChanged }: CategorySettingsProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, Partial<Category>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCat, setNewCat] = useState({ color: '#6B7280', label: '', description: '', ai_description: '' });

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Global actions state
  const [reclassifyMode, setReclassifyMode] = useState<'all' | 'uncategorized'>('all');
  const [isStripping, setIsStripping] = useState(false);
  const [stripConfirm, setStripConfirm] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, preview: '', errors: 0 });
  const [totalNotes, setTotalNotes] = useState(0);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [catsRes, countsRes, notesRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/categories/counts'),
        fetch('/api/notes'),
      ]);
      const catsData = await catsRes.json();
      const countsData = await countsRes.json();
      const notesData = await notesRes.json();

      setCategories(
        (catsData as Category[])
          .filter((c: Category) => !c.hidden)
          .sort((a: Category, b: Category) => a.sort_order - b.sort_order)
      );
      setNoteCounts(countsData);

      const allNotes = Array.isArray(notesData) ? notesData : [];
      setTotalNotes(allNotes.length);
      setUncategorizedCount(
        allNotes.filter((n: { categories?: string[] }) => !n.categories || n.categories.length === 0).length
      );
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getEditValue = (cat: Category, field: keyof Category) =>
    editState[cat.id]?.[field] ?? cat[field];

  const setEditField = (catId: string, field: keyof Category, value: string) => {
    setEditState(prev => ({ ...prev, [catId]: { ...prev[catId], [field]: value } }));
  };

  const handleSave = async (cat: Category) => {
    const changes = editState[cat.id];
    if (!changes || Object.keys(changes).length === 0) return;

    setSaving(prev => ({ ...prev, [cat.id]: true }));
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (res.ok) {
        const updated = await res.json();
        setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, ...updated } : c));
        setEditState(prev => { const next = { ...prev }; delete next[cat.id]; return next; });
        onCategoriesChanged();
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(prev => ({ ...prev, [cat.id]: false }));
    }
  };

  const handleDelete = async (cat: Category) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== cat.id));
        setDeleteConfirm(null);
        onCategoriesChanged();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleCreate = async () => {
    if (!newCat.label.trim()) return;
    const id = newCat.label.toLowerCase().replace(/[^a-z0-9àâéèêëïîôùûç]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          label: newCat.label,
          description: newCat.description,
          ai_description: newCat.ai_description,
          color: newCat.color,
          is_builtin: false,
          hidden: false,
          sort_order: categories.length,
        }),
      });
      if (res.ok) {
        setNewCat({ color: '#6B7280', label: '', description: '', ai_description: '' });
        setShowNewForm(false);
        fetchData();
        onCategoriesChanged();
      }
    } catch (err) {
      console.error('Create failed:', err);
    }
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reordered = [...categories];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);

    const withOrder = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(withOrder);
    setDragIdx(null);
    setDragOverIdx(null);

    try {
      await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: withOrder.map(c => ({ id: c.id, sort_order: c.sort_order })) }),
      });
      onCategoriesChanged();
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  const hasChanges = (catId: string) => {
    const changes = editState[catId];
    return changes && Object.keys(changes).length > 0;
  };

  const handleStripAll = async () => {
    setIsStripping(true);
    try {
      const res = await fetch('/api/categories/strip-all', { method: 'POST' });
      if (res.ok) {
        setStripConfirm(false);
        setUncategorizedCount(totalNotes);
        onCategoriesChanged();
        fetchData();
      }
    } catch (err) {
      console.error('Strip failed:', err);
    } finally {
      setIsStripping(false);
    }
  };

  const handleReclassify = async () => {
    setIsReclassifying(true);
    setProgress({ processed: 0, total: 0, preview: '', errors: 0 });

    try {
      const res = await fetch('/api/categories/reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: reclassifyMode }),
      });

      if (!res.ok || !res.body) {
        setIsReclassifying(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'start') {
              setProgress(prev => ({ ...prev, total: event.total }));
            } else if (event.type === 'progress' || event.type === 'skip') {
              setProgress(prev => ({ ...prev, processed: event.processed, preview: event.preview || 'Note vide (ignorée)' }));
            } else if (event.type === 'error') {
              setProgress(prev => ({ ...prev, processed: event.processed, errors: prev.errors + 1, preview: '⚠ Erreur sur une note' }));
            } else if (event.type === 'done') {
              setProgress({ processed: event.processed, total: event.total, errors: event.errors, preview: `${event.processed} notes traitées${event.errors > 0 ? ` (${event.errors} erreurs)` : ''}.` });
            }
          } catch { /* ignore */ }
        }
      }

      onCategoriesChanged();
      fetchData();
      setTimeout(() => setIsReclassifying(false), 2000);
    } catch (err) {
      console.error('Reclassify stream error:', err);
      setIsReclassifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#606060]">
        <p className="text-[14px]">Chargement des catégories…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-semibold text-[#E8E8E8]">Catégories</h2>
          <p className="text-[13px] text-[#808080] mt-1">
            Gère tes catégories et les règles de classification IA
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewForm(true)}
            className="text-[13px] px-3 py-1.5 bg-[#2E7CD1] hover:bg-[#2568B8] text-white rounded-[6px] transition-colors duration-100"
          >
            + Nouvelle catégorie
          </button>
          <button
            onClick={onClose}
            className="text-[13px] px-3 py-1.5 text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A] rounded-[6px] transition-colors duration-100"
          >
            ← Retour
          </button>
        </div>
      </div>

      {/* Global actions bar */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-[8px] p-4 mb-6">
        <p className="text-[11px] text-[#606060] font-medium uppercase tracking-wider mb-3">
          Actions globales
        </p>

        <div className="flex gap-3 flex-wrap">
          {/* Strip all */}
          <div className="flex-1 min-w-[200px]">
            {stripConfirm ? (
              <div className="space-y-2">
                <p className="text-[12px] text-[#F87171]">
                  ⚠ {totalNotes} note{totalNotes !== 1 ? 's' : ''} {totalNotes !== 1 ? 'seront vidées' : 'sera vidée'} de leurs catégories.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleStripAll}
                    disabled={isStripping}
                    className="flex-1 text-[12px] py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-[6px] transition-colors disabled:opacity-50"
                  >
                    {isStripping ? 'En cours…' : 'Confirmer'}
                  </button>
                  <button
                    onClick={() => setStripConfirm(false)}
                    className="flex-1 text-[12px] py-2 text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A] rounded-[6px] transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setStripConfirm(true)}
                  className="w-full text-[13px] py-2 px-3 border border-[#DC2626]/30 text-[#F87171] hover:bg-[#DC2626]/10 rounded-[6px] transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  Retirer toutes les catégories
                </button>
                <p className="text-[11px] text-[#505050] mt-1.5">
                  Vide les catégories de toutes les notes. Les notes ne sont pas supprimées.
                </p>
              </>
            )}
          </div>

          {/* Reclassify */}
          <div className="flex-1 min-w-[260px]">
            <div className="flex mb-2">
              <button
                onClick={() => setReclassifyMode('all')}
                className={`flex-1 text-[12px] py-2 px-3 rounded-l-[6px] border transition-colors ${
                  reclassifyMode === 'all'
                    ? 'bg-[#2E7CD1]/15 text-[#2E7CD1] border-[#2E7CD1]/40'
                    : 'text-[#9B9B9B] border-[#2A2A2A] hover:bg-[#2A2A2A]'
                }`}
              >
                Toutes ({totalNotes})
              </button>
              <button
                onClick={() => setReclassifyMode('uncategorized')}
                className={`flex-1 text-[12px] py-2 px-3 rounded-r-[6px] border border-l-0 transition-colors ${
                  reclassifyMode === 'uncategorized'
                    ? 'bg-[#2E7CD1]/15 text-[#2E7CD1] border-[#2E7CD1]/40'
                    : 'text-[#9B9B9B] border-[#2A2A2A] hover:bg-[#2A2A2A]'
                }`}
              >
                Sans catégorie ({uncategorizedCount})
              </button>
            </div>
            <button
              onClick={handleReclassify}
              disabled={isReclassifying}
              className="w-full text-[13px] py-2 px-3 bg-[#2E7CD1]/15 text-[#2E7CD1] border border-[#2E7CD1]/30 hover:bg-[#2E7CD1]/25 rounded-[6px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              {isReclassifying ? 'Reclassification en cours…' : "Reclassifier avec l'IA"}
            </button>
            <p className="text-[11px] text-[#505050] mt-1.5">
              Relance la classification IA sur les notes sélectionnées.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {isReclassifying && progress.total > 0 && (
          <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] text-[#D4D4D4]">
                {progress.processed >= progress.total ? 'Terminé !' : 'Reclassification en cours…'}
              </span>
              <span className="text-[13px] font-medium text-[#2E7CD1] tabular-nums">
                {progress.processed} / {progress.total}
              </span>
            </div>
            <div className="w-full h-[6px] bg-[#252525] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2E7CD1] rounded-full transition-all duration-300"
                style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#505050] mt-1.5 truncate">{progress.preview}</p>
            {progress.errors > 0 && (
              <p className="text-[11px] text-[#F87171] mt-1">
                {progress.errors} erreur{progress.errors > 1 ? 's' : ''} rencontrée{progress.errors > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Category list */}
      <div className="space-y-2">
        {categories.map((cat, idx) => {
          const isExpanded = expandedId === cat.id;
          const isDragging = dragIdx === idx;
          const isDragOver = dragOverIdx === idx;
          const count = noteCounts[cat.id] || 0;

          return (
            <div
              key={cat.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`
                border rounded-[8px] transition-all duration-150
                ${isDragging ? 'opacity-30' : ''}
                ${isDragOver ? 'border-[#2E7CD1] bg-[#2E7CD1]/5' : 'border-[#2A2A2A] bg-[#1F1F1F]'}
                ${isExpanded ? 'border-[#333]' : 'hover:border-[#333]'}
              `}
            >
              {/* Clickable header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-[#606060] cursor-grab active:cursor-grabbing text-[12px] select-none">⠿</span>

                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: String(getEditValue(cat, 'color')) }}
                />

                <span className="text-[14px] font-medium text-[#E8E8E8] flex-1 truncate">
                  {String(getEditValue(cat, 'label'))}
                </span>

                <span className="text-[11px] text-[#808080] bg-[#252525] px-2 py-0.5 rounded-[4px] tabular-nums">
                  {count} note{count !== 1 ? 's' : ''}
                </span>

                <svg
                  className={`w-4 h-4 text-[#606060] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                >
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>

              {/* Edit panel */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-[#2A2A2A] space-y-3">
                  <div className="grid grid-cols-[60px_1fr] gap-3">
                    <div>
                      <label className="text-[11px] text-[#606060] block mb-1">Couleur</label>
                      <input
                        type="color"
                        value={String(getEditValue(cat, 'color'))}
                        onChange={e => setEditField(cat.id, 'color', e.target.value)}
                        className="w-full h-[36px] border-none cursor-pointer bg-transparent rounded-[6px]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#606060] block mb-1">Nom</label>
                      <input
                        value={String(getEditValue(cat, 'label'))}
                        onChange={e => setEditField(cat.id, 'label', e.target.value)}
                        className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[6px] h-[36px] px-3 text-[14px] text-[#D4D4D4] focus:outline-none focus:border-[#2E7CD1]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#606060] block mb-1">Description (visible par toi)</label>
                    <input
                      value={String(getEditValue(cat, 'description'))}
                      onChange={e => setEditField(cat.id, 'description', e.target.value)}
                      placeholder="Ce que cette catégorie représente pour toi"
                      className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[6px] h-[36px] px-3 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#606060] block mb-1">Règles de classification IA</label>
                    <textarea
                      value={String(getEditValue(cat, 'ai_description'))}
                      onChange={e => setEditField(cat.id, 'ai_description', e.target.value)}
                      rows={3}
                      placeholder="Décris les types de notes que l'IA doit classer ici. Ex: Blockchain, cryptomonnaies, DeFi, Web3, NFTs..."
                      className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[6px] px-3 py-2 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] resize-y leading-relaxed"
                    />
                    <p className="text-[11px] text-[#505050] mt-1">
                      L&apos;IA utilise ce texte pour décider si une note appartient à cette catégorie.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {deleteConfirm === cat.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[#F87171]">
                          ⚠ {count} note{count !== 1 ? 's' : ''} {count !== 1 ? 'seront décatégorisées' : 'sera décatégorisée'}. Confirmer ?
                        </span>
                        <button
                          onClick={() => handleDelete(cat)}
                          className="text-[12px] text-white bg-[#DC2626] hover:bg-[#B91C1C] px-2 py-1 rounded-[4px] transition-colors"
                        >
                          Supprimer
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-[12px] text-[#9B9B9B] hover:text-[#D4D4D4] px-2 py-1"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(cat.id)}
                        className="text-[12px] text-[#9B9B9B] hover:text-[#F87171] transition-colors"
                      >
                        Supprimer cette catégorie
                      </button>
                    )}

                    {hasChanges(cat.id) && (
                      <button
                        onClick={() => handleSave(cat)}
                        disabled={saving[cat.id]}
                        className={`text-[13px] px-4 py-1.5 rounded-[6px] transition-colors duration-100 ${
                          saving[cat.id]
                            ? 'bg-[#2A2A2A] text-[#606060]'
                            : 'bg-[#2E7CD1] hover:bg-[#2568B8] text-white'
                        }`}
                      >
                        {saving[cat.id] ? '✓ Sauvegardé' : 'Sauvegarder'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New category form */}
      {showNewForm && (
        <div className="mt-4 border border-[#2A2A2A] bg-[#1F1F1F] rounded-[8px] p-4 space-y-3">
          <p className="text-[15px] font-medium text-[#E8E8E8]">Nouvelle catégorie</p>

          <div className="grid grid-cols-[60px_1fr] gap-3">
            <div>
              <label className="text-[11px] text-[#606060] block mb-1">Couleur</label>
              <input
                type="color"
                value={newCat.color}
                onChange={e => setNewCat(prev => ({ ...prev, color: e.target.value }))}
                className="w-full h-[36px] border-none cursor-pointer bg-transparent rounded-[6px]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#606060] block mb-1">Nom</label>
              <input
                value={newCat.label}
                onChange={e => setNewCat(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Ex: Crypto / Web3"
                className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[6px] h-[36px] px-3 text-[14px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1]"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[#606060] block mb-1">Description</label>
            <input
              value={newCat.description}
              onChange={e => setNewCat(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ce que cette catégorie représente pour toi"
              className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[6px] h-[36px] px-3 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#606060] block mb-1">Règles de classification IA</label>
            <textarea
              value={newCat.ai_description}
              onChange={e => setNewCat(prev => ({ ...prev, ai_description: e.target.value }))}
              rows={3}
              placeholder="Décris les types de notes que l'IA doit classer ici. Sois précis : mots-clés, sujets, contextes…"
              className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[6px] px-3 py-2 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] resize-y leading-relaxed"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowNewForm(false); setNewCat({ color: '#6B7280', label: '', description: '', ai_description: '' }); }}
              className="text-[13px] px-3 py-1.5 text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A] rounded-[6px] transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              className="text-[13px] px-4 py-1.5 bg-[#2E7CD1] hover:bg-[#2568B8] text-white rounded-[6px] transition-colors"
            >
              Créer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

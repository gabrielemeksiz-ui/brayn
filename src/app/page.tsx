'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Note, NoteCategory } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_OUTLINE, CATEGORY_DOT } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { NoteEditor } from '@/components/NoteEditor';

type Section = 'new' | 'all' | 'recent' | NoteCategory;

export default function BraynPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [section, setSection] = useState<Section>('new');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<NoteCategory | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<NoteCategory | string>>(new Set());
  const [expandNewSection, setExpandNewSection] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [customCategories, setCustomCategories] = useState<{id: string; label: string; description: string}[]>([]);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, {label: string; description: string}>>({});
  const [draggedNote, setDraggedNote] = useState<Note | null>(null);
  const [dragSourceCat, setDragSourceCat] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const fetchAllNotes = useCallback(async () => {
    const res = await fetch('/api/notes');
    const data = await res.json();
    setAllNotes(data);
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();

    if (section === 'new') params.set('seen', 'false');
    if (section === 'recent')
      params.set('from', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    if (section !== 'new' && section !== 'all' && section !== 'recent') {
      params.set('category', section);
    }
    if (search) params.set('q', search);
    if (filterCat) params.set('category', filterCat);
    if (filterPeriod === 'today') params.set('from', new Date().toISOString().split('T')[0]);
    if (filterPeriod === '7d')
      params.set('from', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    if (filterPeriod === '30d')
      params.set('from', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);

    const res = await fetch(`/api/notes?${params}`);
    const data = await res.json();
    setNotes(data);
    setLoading(false);
  }, [section, search, filterCat, filterPeriod]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    fetchAllNotes();
  }, [fetchAllNotes]);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((rows: { id: string; label: string; description: string; is_builtin: boolean; hidden: boolean }[]) => {
        setCustomCategories(rows.filter(r => !r.is_builtin).map(r => ({ id: r.id, label: r.label, description: r.description })));
        const overrides: Record<string, { label: string; description: string }> = {};
        const hidden = new Set<string>();
        rows.filter(r => r.is_builtin).forEach(r => {
          overrides[r.id] = { label: r.label, description: r.description };
          if (r.hidden) hidden.add(r.id);
        });
        setCategoryOverrides(overrides);
        setHiddenCategories(hidden);
      })
      .catch(() => {});
  }, []);

  const getNewNotes = () => {
    return allNotes.filter(note => !note.seen);
  };

  const openNote = async (note: Note) => {
    console.log('openNote id =', note.id, 'seen =', note.seen);

    setSelected({ ...note, seen: true });

    if (!note.seen) {
      try {
        const res = await fetch(`/api/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seen: true }),
        });

        if (!res.ok) {
          console.error('PATCH /api/notes/[id] failed', await res.text());
          return;
        }

        const updated: Note = await res.json();

        setNotes(prev => prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n)));
        setAllNotes(prev => prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n)));
      } catch (e) {
        console.error('Failed to update note seen status', e);
      }
    }
  };

  const toggleCategoryExpand = (cat: NoteCategory | string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
    } else {
      newExpanded.add(cat);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryNotes = (cat: NoteCategory | string) => {
    return allNotes.filter(note =>
      (note.categories as (NoteCategory | string)[]).includes(cat),
    );
  };

  const createEmptyNote = async () => {
    try {
      const res = await fetch('/api/notes/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ' ', source: 'desktop', customCategories }),
      });

      if (res.ok) {
        const { note } = await res.json();
        setShowActionMenu(false);
        await Promise.all([fetchNotes(), fetchAllNotes()]);
        if (note) openNote(note);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const createNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    const id = newCategoryName.toLowerCase().replace(/\s+/g, '_');
    if (customCategories.find(c => c.id === id)) return;
    const newCat = { id, label: newCategoryName, description: newCategoryDesc };
    setCustomCategories([...customCategories, newCat]);
    setNewCategoryName('');
    setNewCategoryDesc('');
    setShowNewCategoryForm(false);
    setShowActionMenu(false);
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCat, is_builtin: false }),
    });
  };

  const getAllCategories = (): (NoteCategory | string)[] => {
    return [...ALL_CATEGORIES, ...customCategories.map(c => c.id)].filter(c => !hiddenCategories.has(c));
  };

  const updateNoteCategories = async (note: Note, newCategories: NoteCategory[]) => {
    const updated = { ...note, categories: newCategories };
    setSelected(updated);
    setNotes(prev => prev.map(n => (n.id === note.id ? updated : n)));
    setAllNotes(prev => prev.map(n => (n.id === note.id ? updated : n)));
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: newCategories }),
    });
  };

  const sidebarItem = (label: string, value: Section, badge?: number) => (
    <button
      key={value}
      onClick={() => setSection(value)}
      className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 flex items-center justify-between
        ${section === value
          ? 'bg-white/10 text-white font-medium'
          : 'text-zinc-300 hover:text-white hover:bg-white/5'
        }`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-indigo-500/80 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );

  const newCount = getNewNotes().length;

  return (
    <div className="h-screen bg-[#282828] text-white flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1e1e1e] border-r border-white/[0.06] flex flex-col p-3 gap-0.5 shrink-0">
        <div className="space-y-2 mb-3 relative">
          <div className="flex items-center justify-between px-2 py-3">
            <h1 className="text-[15px] font-semibold tracking-tight text-white/90">🧠 Brayn</h1>
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="text-zinc-500 hover:text-zinc-200 text-xl leading-none transition-colors duration-150 w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/8"
            >
              +
            </button>
          </div>
          {showActionMenu && (
            <div className="absolute top-14 right-2 bg-[#282828] border border-white/10 rounded-lg shadow-lg overflow-hidden z-50">
              <button
                onClick={() => {
                  createEmptyNote();
                  setShowActionMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 transition-all whitespace-nowrap"
              >
                Créer une note
              </button>
              <button
                onClick={() => { setShowActionMenu(false); setShowNewCategoryForm(true); }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 transition-all whitespace-nowrap border-t border-white/5"
              >
                Créer une catégorie
              </button>
            </div>
          )}
          {showNewCategoryForm && (
            <div className="space-y-2 px-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Nom de la catégorie…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                autoFocus
              />
              <textarea
                value={newCategoryDesc}
                onChange={e => setNewCategoryDesc(e.target.value)}
                placeholder="Description pour l'IA (ex: notes sur le droit, les lois, la justice…)"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={createNewCategory}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1.5 rounded-lg transition-all font-medium"
                >
                  Créer
                </button>
                <button
                  onClick={() => {
                    setShowNewCategoryForm(false);
                    setNewCategoryName('');
                    setNewCategoryDesc('');
                  }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-400 text-xs py-1.5 rounded-lg transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-[10px] text-zinc-600 px-2 pt-2 pb-1 font-semibold tracking-wider uppercase">
          Vues
        </div>

        {/* Expandable "Nouveaux" section */}
        <div className="space-y-1">
          <button
            onClick={() => setExpandNewSection(!expandNewSection)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-150 flex items-center justify-between
              ${section === 'new' ? 'bg-white/10 text-white font-medium' : 'text-zinc-300 hover:text-white hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-2 flex-1">
              <span className={`text-[9px] transition-transform duration-150 ${expandNewSection ? 'rotate-90' : ''}`}>▶</span>
              Nouveaux
            </span>
            {newCount > 0 && (
              <span className="bg-indigo-500/80 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums">
                {newCount}
              </span>
            )}
          </button>
          {expandNewSection && (
            <div className="pl-6 space-y-1 max-h-48 overflow-y-auto">
              {getNewNotes().length === 0 ? (
                <p className="text-xs text-zinc-600 py-2">Aucune note</p>
              ) : (
                getNewNotes().map(note => (
                  <button
                    key={note.id}
                    onClick={() => {
                      setSection('new');
                      openNote(note);
                    }}
                    className={`w_full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all truncate
                      ${
                        selected?.id === note.id
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    {note.clean_original_language ?? note.original_text}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {sidebarItem('Tous', 'all')}
        {sidebarItem('Récents', 'recent')}

        <div className="text-[10px] text-zinc-600 px-2 pt-4 pb-1 font-semibold tracking-wider uppercase">
          Catégories
        </div>
        {getAllCategories().map(cat => {
          const isBuiltin = ALL_CATEGORIES.includes(cat as NoteCategory);
          const isExpanded = expandedCategories.has(cat);
          const categoryNotes = getCategoryNotes(cat);
          const customCat = customCategories.find(c => c.id === cat);
          const override = categoryOverrides[cat];
          const label = override?.label || CATEGORY_LABELS[cat as NoteCategory] || customCat?.label || cat;
          const description = override?.description ?? customCat?.description ?? '';
          const isEditing = editingCatId === cat;

          const handleSave = async () => {
            if (!editingCatName.trim()) return;
            if (isBuiltin) {
              setCategoryOverrides(prev => ({ ...prev, [cat]: { label: editingCatName, description: editingCatDesc } }));
              await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cat, label: editingCatName, description: editingCatDesc, is_builtin: true, hidden: false }),
              });
            } else {
              setCustomCategories(prev => prev.map(c =>
                c.id === cat ? { ...c, label: editingCatName, description: editingCatDesc } : c
              ));
              await fetch(`/api/categories/${cat}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: editingCatName, description: editingCatDesc }),
              });
            }
            setEditingCatId(null);
          };

          const handleDelete = async () => {
            if (isBuiltin) {
              setHiddenCategories(prev => new Set([...prev, cat]));
              await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cat, label, description, is_builtin: true, hidden: true }),
              });
            } else {
              setCustomCategories(prev => prev.filter(c => c.id !== cat));
              await fetch(`/api/categories/${cat}`, { method: 'DELETE' });
            }
          };

          return (
            <div key={cat} className="space-y-1">
              {isEditing ? (
                <div className="space-y-1.5 px-2 py-1">
                  <input
                    type="text"
                    value={editingCatName}
                    onChange={e => setEditingCatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    autoFocus
                  />
                  <textarea
                    value={editingCatDesc}
                    onChange={e => setEditingCatDesc(e.target.value)}
                    placeholder="Description pour l'IA…"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 resize-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleSave}
                      className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1 rounded-lg transition-all"
                    >
                      Sauvegarder
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-400 text-xs py-1 rounded-lg transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`group flex items-center rounded-lg transition-all ${
                    dragOverCat === cat && draggedNote && dragSourceCat !== cat
                      ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40'
                      : 'hover:bg-white/5'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOverCat(cat); }}
                  onDragLeave={() => setDragOverCat(null)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverCat(null);
                    if (!draggedNote || dragSourceCat === cat) return;
                    const newCats = (draggedNote.categories as string[]).filter(c => c !== dragSourceCat);
                    if (!newCats.includes(cat)) newCats.push(cat);
                    updateNoteCategories(draggedNote, newCats as NoteCategory[]);
                    setDraggedNote(null);
                    setDragSourceCat(null);
                  }}
                >
                  <button
                    onClick={() => toggleCategoryExpand(cat)}
                    className="flex-1 text-left px-3 py-1.5 text-sm flex items-center gap-2 text-zinc-300 group-hover:text-white transition-colors duration-150"
                  >
                    <span className={`text-[9px] transition-transform duration-150 text-zinc-500 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    {label}
                  </button>
                  <span className="text-[11px] text-zinc-400 pr-2 group-hover:hidden tabular-nums">{categoryNotes.length}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5 pr-1.5">
                    <button
                      onClick={() => {
                        setEditingCatId(cat);
                        setEditingCatName(label);
                        setEditingCatDesc(description);
                      }}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-1 py-0.5 rounded transition-all"
                      title="Renommer"
                    >
                      ✎
                    </button>
                    <button
                      onClick={handleDelete}
                      className="text-zinc-500 hover:text-red-400 text-xs px-1 py-0.5 rounded transition-all"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              {isExpanded && !isEditing && (
                <div className="pl-6 space-y-1 max-h-48 overflow-y-auto">
                  {categoryNotes.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-2">Aucune note</p>
                  ) : (
                    categoryNotes.map(note => (
                      <button
                        key={note.id}
                        draggable
                        onDragStart={() => { setDraggedNote(note); setDragSourceCat(cat); }}
                        onDragEnd={() => { setDraggedNote(null); setDragSourceCat(null); setDragOverCat(null); }}
                        onClick={() => openNote(note)}
                        className={`w-full text-left px-2.5 py-1 rounded-md text-xs transition-colors duration-150 truncate cursor-grab active:cursor-grabbing
                          ${
                            draggedNote?.id === note.id
                              ? 'opacity-30'
                              : selected?.id === note.id
                              ? 'bg-indigo-500/15 text-indigo-300'
                              : 'text-zinc-300 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        {note.clean_original_language ?? note.original_text}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* Zone principale */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Barre de recherche */}
        <div className="px-5 pt-4 pb-3 border-b border-white/[0.06] space-y-2.5 shrink-0">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher dans mon cerveau…"
                className="w-full bg-white/5 border border-white/[0.08] rounded-lg pl-8 pr-4 py-2 text-sm placeholder-zinc-600 text-white focus:outline-none focus:border-white/20 focus:bg-white/6 transition-colors duration-150"
              />
            </div>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')}
              className="bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-white/20 transition-colors duration-150 hover:border-white/15 cursor-pointer"
            >
              <option value="all">Tout</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] border whitespace-nowrap transition-colors duration-150
                  ${filterCat === cat
                    ? CATEGORY_COLORS[cat]
                    : `bg-transparent ${CATEGORY_OUTLINE[cat]} opacity-60 hover:opacity-100`
                  }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu — note ouverte ou état vide */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar — minimal */}
            <div className="flex items-center justify-between px-6 py-2 border-b border-white/[0.06] shrink-0">
              <span className="text-[11px] text-zinc-700 font-mono">{selected.id.slice(0, 8)}…</span>
              <button
                onClick={() => setSelected(null)}
                className="text-zinc-600 hover:text-zinc-300 text-xl leading-none transition-colors duration-150 w-6 h-6 flex items-center justify-center rounded hover:bg-white/5"
              >
                ×
              </button>
            </div>

            {/* Page Notion-style */}
            <div className="flex-1 flex flex-col overflow-hidden px-10 pt-6">

                {/* Header compact */}
                <div className="shrink-0 mb-3">
                  <h1 className="text-2xl font-bold text-white mb-3 leading-snug">
                    {selected.clean_original_language ?? selected.original_text}
                  </h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-zinc-600">{formatDate(selected.created_at)}</span>
                    <span className="text-xs text-zinc-700">·</span>
                    <span className="text-xs text-zinc-600 capitalize">{selected.source}</span>
                    {selected.categories.length > 0 && <span className="text-xs text-zinc-700">·</span>}
                    {selected.categories.map(cat => (
                      <span
                        key={cat}
                        className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${CATEGORY_COLORS[cat]}`}
                      >
                        {CATEGORY_LABELS[cat]}
                        <button
                          onClick={() =>
                            updateNoteCategories(
                              selected,
                              selected.categories.filter(c => c !== cat),
                            )
                          }
                          className="opacity-50 hover:opacity-100 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <select
                      value=""
                      onChange={e => {
                        const cat = e.target.value as NoteCategory;
                        if (cat && !selected.categories.includes(cat)) {
                          updateNoteCategories(selected, [...selected.categories, cat]);
                        }
                      }}
                      className="text-xs bg-transparent border border-white/10 rounded-full px-2 py-0.5 text-zinc-600 focus:outline-none hover:border-white/20 hover:text-zinc-300 cursor-pointer transition-all"
                    >
                      <option value="">+ Catégorie</option>
                      {ALL_CATEGORIES.filter(c => !selected.categories.includes(c)).map(cat => (
                        <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-b border-white/5 mb-3 shrink-0" />

                {/* Éditeur — remplit tout l'espace restant */}
                <div className="flex-1 min-h-0 pb-4 flex flex-col">
                  <NoteEditor
                    noteId={selected.id}
                    initialFullText={
                      selected.full_text ??
                      [
                        selected.original_text,
                        '',
                        '---',
                        '',
                        'VERSION PROPRE',
                        selected.clean_original_language ?? '',
                        '',
                        'TRADUCTION',
                        selected.clean_other_language ?? '',
                      ].join('\n')
                    }
                  />
                </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none">
            <span className="text-4xl opacity-20">🧠</span>
            <p className="text-zinc-600 text-sm">Sélectionne une note dans la sidebar</p>
          </div>
        )}
      </main>
    </div>
  );
}

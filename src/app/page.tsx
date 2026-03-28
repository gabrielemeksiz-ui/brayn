'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useUser } from '@/lib/hooks/useUser';
import { useRealtimeNotes } from '@/lib/hooks/useRealtimeNotes';
import type { Note, NoteCategory } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_OUTLINE, CATEGORY_DOT } from '@/lib/types';
import { NoteList } from '@/components/NoteList';
import { NoteDetail } from '@/components/NoteDetail';

function extractTweetUrls(links: string[], originalText: string): string[] {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/gi;
  const fromLinks = links.filter(l => /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i.test(l));
  if (fromLinks.length > 0) return fromLinks;
  return [...originalText.matchAll(tweetRegex)].map(m => m[0]);
}

function noteTitle(note: { links: string[] | null; original_text: string | null; clean_original_language?: string | null }): string {
  const isTweet = extractTweetUrls(note.links ?? [], note.original_text ?? '').length > 0;
  if (isTweet) return note.clean_original_language ?? note.original_text ?? '';
  return note.original_text ?? '';
}

type Section = 'new' | 'all' | 'recent' | NoteCategory;

export default function BraynPage() {
  const router = useRouter();
  const { isAdmin, user } = useUser();
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
  const [youtubeSyncing, setYoutubeSyncing] = useState(false);
  const [youtubeSyncResult, setYoutubeSyncResult] = useState<string | null>(null);
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

  // Suppression
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const deleteNotes = async (ids: string[]) => {
    await Promise.all(ids.map(id => fetch(`/api/notes/${id}`, { method: 'DELETE' })));
    setAllNotes(prev => prev.filter(n => !ids.includes(n.id)));
    setNotes(prev => prev.filter(n => !ids.includes(n.id)));
    if (selected && ids.includes(selected.id)) setSelected(null);
    setConfirmDelete(null);
  };

  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu action au clic extérieur
  useEffect(() => {
    if (!showActionMenu) return;
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showActionMenu]);

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

  useRealtimeNotes({
    userId: user?.id,
    onInsert: useCallback((note: Note) => {
      setAllNotes(prev => [note, ...prev.filter(n => n.id !== note.id)]);
      setNotes(prev => [note, ...prev.filter(n => n.id !== note.id)]);
    }, []),
    onUpdate: useCallback((note: Note) => {
      setAllNotes(prev => prev.map(n => n.id === note.id ? note : n));
      setNotes(prev => prev.map(n => n.id === note.id ? note : n));
      setSelected(prev => prev?.id === note.id ? { ...prev, ...note } : prev);
    }, []),
    onDelete: useCallback((noteId: string) => {
      setAllNotes(prev => prev.filter(n => n.id !== noteId));
      setNotes(prev => prev.filter(n => n.id !== noteId));
      setSelected(prev => prev?.id === noteId ? null : prev);
    }, []),
  });

  const getNewNotes = () => {
    return allNotes.filter(note => !note.seen);
  };

  const openNote = async (note: Note) => {
    setSelected({ ...note, seen: true });

    // Expand la première catégorie de la note dans la sidebar
    if (note.categories.length > 0) {
      setExpandedCategories(prev => {
        const next = new Set(prev);
        note.categories.forEach(cat => next.add(cat));
        return next;
      });
    }

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
      setShowActionMenu(false);
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nouvelle note', source: 'desktop' }),
      });
      if (!res.ok) return;
      const { note } = await res.json();
      await Promise.all([fetchNotes(), fetchAllNotes()]);
      if (note) {
        setSection('new');
        openNote(note);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const syncYoutube = async () => {
    setShowActionMenu(false);
    setYoutubeSyncing(true);
    setYoutubeSyncResult(null);
    try {
      const res = await fetch('/api/youtube/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const msg = `${data.imported} importée(s), ${data.skipped} ignorée(s)`;
        setYoutubeSyncResult(msg);
        if (data.imported > 0) await Promise.all([fetchNotes(), fetchAllNotes()]);
        setTimeout(() => setYoutubeSyncResult(null), 4000);
      }
    } catch { /* fail silently */ }
    finally { setYoutubeSyncing(false); }
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

  const getCatLabel = (cat: string): string => {
    return categoryOverrides[cat]?.label || CATEGORY_LABELS[cat as NoteCategory] || customCategories.find(c => c.id === cat)?.label || cat;
  };

  const getCatColor = (cat: string): string => {
    return CATEGORY_COLORS[cat as NoteCategory] || 'border-[#555] text-[#B0B0B0]';
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
      onClick={() => { setSection(value); setSelected(null); }}
      className={`w-full text-left px-2 py-[5px] rounded-[4px] text-[14px] transition-colors duration-100 flex items-center justify-between
        ${section === value
          ? 'bg-[#2E7CD1]/15 text-[#2E7CD1]'
          : 'text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A]'
        }`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-[#2E7CD1] text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );

  const newCount = getNewNotes().length;

  return (
    <div className="h-screen bg-[#191919] text-[#D4D4D4] flex overflow-hidden" style={{fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)"}}>
      {/* Sidebar */}
      <aside className="w-64 bg-[#202020] border-r border-[#2A2A2A] flex flex-col shrink-0 overflow-y-auto">

        {/* Header */}
        <div className="relative px-3 pt-4 pb-2">
          <div className="flex items-center justify-between px-1 py-1 mb-1">
            <h1 className="text-[14px] font-medium text-[#D4D4D4]">🧠 Brayn</h1>
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A] w-6 h-6 flex items-center justify-center rounded-[4px] transition-colors duration-100 text-lg leading-none"
            >
              +
            </button>
          </div>

          {showActionMenu && (
            <div ref={actionMenuRef} className="absolute top-12 right-3 bg-[#252525] border border-[#2A2A2A] rounded-[6px] shadow-xl overflow-hidden z-50 min-w-[160px]">
              <button
                onClick={() => { createEmptyNote(); setShowActionMenu(false); }}
                className="w-full text-left px-3 py-2 text-[13px] text-[#D4D4D4] hover:bg-[#2A2A2A] transition-colors duration-100 whitespace-nowrap"
              >
                Créer une note
              </button>
              <button
                onClick={() => { setShowActionMenu(false); setShowNewCategoryForm(true); }}
                className="w-full text-left px-3 py-2 text-[13px] text-[#D4D4D4] hover:bg-[#2A2A2A] transition-colors duration-100 whitespace-nowrap border-t border-[#2A2A2A]"
              >
                Créer une catégorie
              </button>
              {isAdmin && (
                <button
                  onClick={syncYoutube}
                  disabled={youtubeSyncing}
                  className="w-full text-left px-3 py-2 text-[13px] text-[#D4D4D4] hover:bg-[#2A2A2A] transition-colors duration-100 whitespace-nowrap border-t border-[#2A2A2A] disabled:opacity-40"
                >
                  {youtubeSyncing ? 'Sync en cours…' : 'Sync YouTube'}
                </button>
              )}
            </div>
          )}

          {youtubeSyncResult && (
            <p className="text-[11px] text-[#9B9B9B] px-1 mt-1">{youtubeSyncResult}</p>
          )}

          {showNewCategoryForm && (
            <div className="space-y-2 mt-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Nom de la catégorie…"
                className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-3 py-1.5 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1]"
                autoFocus
              />
              <textarea
                value={newCategoryDesc}
                onChange={e => setNewCategoryDesc(e.target.value)}
                placeholder="Description pour l'IA…"
                rows={2}
                className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-3 py-1.5 text-[12px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={createNewCategory}
                  className="flex-1 bg-[#2E7CD1] hover:bg-[#2568B8] text-white text-[12px] py-1.5 rounded-[4px] transition-colors duration-100 font-medium"
                >
                  Créer
                </button>
                <button
                  onClick={() => { setShowNewCategoryForm(false); setNewCategoryName(''); setNewCategoryDesc(''); }}
                  className="flex-1 bg-[#2A2A2A] hover:bg-[#333] text-[#9B9B9B] text-[12px] py-1.5 rounded-[4px] transition-colors duration-100"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav section */}
        <div className="px-3 pb-1">
          <p className="text-[11px] text-[#606060] font-medium uppercase tracking-wider px-1 pt-1 pb-1">Vues</p>

          {/* Expandable "Nouveaux" section */}
          <div>
            <button
              onClick={() => setExpandNewSection(!expandNewSection)}
              className={`w-full text-left px-2 py-[5px] rounded-[4px] text-[14px] transition-colors duration-100 flex items-center justify-between
                ${section === 'new' ? 'bg-[#2E7CD1]/15 text-[#2E7CD1]' : 'text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A]'}`}
            >
              <span className="flex items-center gap-1.5 flex-1">
                <span className={`text-[8px] transition-transform duration-100 opacity-60 ${expandNewSection ? 'rotate-90' : ''}`}>▶</span>
                Nouveaux
              </span>
              {newCount > 0 && (
                <span className="bg-[#2E7CD1] text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums">
                  {newCount}
                </span>
              )}
            </button>
            {expandNewSection && (
              <div className="pl-5 space-y-0.5 mt-0.5 max-h-48 overflow-y-auto">
                {getNewNotes().length === 0 ? (
                  <p className="text-[12px] text-[#606060] py-2 px-2">Aucune note</p>
                ) : (
                  getNewNotes().map(note => (
                    <button
                      key={note.id}
                      onClick={() => { setSection('new'); openNote(note); }}
                      className={`w-full text-left px-2 py-[4px] rounded-[4px] text-[13px] transition-colors duration-100 truncate
                        ${selected?.id === note.id
                          ? 'bg-[#2E7CD1]/15 text-[#2E7CD1]'
                          : 'text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A]'
                        }`}
                    >
                      {noteTitle(note)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {sidebarItem('Tous', 'all')}
        </div>

        {/* Categories section */}
        <div className="px-3 mt-2">
          <p className="text-[11px] text-[#606060] font-medium uppercase tracking-wider px-1 pt-1 pb-1">Catégories</p>
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
                    className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-2.5 py-1.5 text-[13px] text-[#D4D4D4] focus:outline-none focus:border-[#2E7CD1]"
                    autoFocus
                  />
                  <textarea
                    value={editingCatDesc}
                    onChange={e => setEditingCatDesc(e.target.value)}
                    placeholder="Description pour l'IA…"
                    rows={2}
                    className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-2.5 py-1.5 text-[12px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] resize-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleSave}
                      className="flex-1 bg-[#2E7CD1] hover:bg-[#2568B8] text-white text-[12px] py-1 rounded-[4px] transition-colors duration-100"
                    >
                      Sauvegarder
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      className="flex-1 bg-[#2A2A2A] hover:bg-[#333] text-[#9B9B9B] text-[12px] py-1 rounded-[4px] transition-colors duration-100"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`group flex items-center rounded-[4px] transition-colors duration-100 ${
                    dragOverCat === cat && draggedNote && dragSourceCat !== cat
                      ? 'bg-[#2E7CD1]/10 outline outline-1 outline-[#2E7CD1]/30'
                      : 'hover:bg-[#2A2A2A]'
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
                    className="flex-1 text-left px-2 py-[5px] text-[14px] flex items-center gap-1.5 text-[#9B9B9B] group-hover:text-[#D4D4D4] transition-colors duration-100"
                  >
                    <span className={`text-[8px] opacity-50 transition-transform duration-100 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    {label}
                  </button>
                  <span className="text-[11px] text-[#606060] pr-2 group-hover:hidden tabular-nums">{categoryNotes.length}</span>
                  <div className="hidden group-hover:flex items-center gap-1 pr-1.5">
                    <button
                      onClick={() => { setEditingCatId(cat); setEditingCatName(label); setEditingCatDesc(description); }}
                      className="text-[#909090] hover:text-[#D4D4D4] text-sm w-6 h-6 flex items-center justify-center rounded-[4px] hover:bg-[#2A2A2A] transition-colors duration-100"
                      title="Renommer"
                    >
                      ✎
                    </button>
                    <button
                      onClick={handleDelete}
                      className="text-[#909090] hover:text-red-400 text-sm w-6 h-6 flex items-center justify-center rounded-[4px] hover:bg-red-500/10 transition-colors duration-100"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              {isExpanded && !isEditing && (
                <div className="pl-5 space-y-0.5 mt-0.5 max-h-48 overflow-y-auto">
                  {categoryNotes.length === 0 ? (
                    <p className="text-[12px] text-[#606060] py-2 px-2">Aucune note</p>
                  ) : (
                    categoryNotes.map(note => (
                      <button
                        key={note.id}
                        draggable
                        onDragStart={() => { setDraggedNote(note); setDragSourceCat(cat); }}
                        onDragEnd={() => { setDraggedNote(null); setDragSourceCat(null); setDragOverCat(null); }}
                        onClick={() => { setSection(cat as Section); openNote(note); }}
                        className={`w-full text-left px-2 py-[4px] rounded-[4px] text-[13px] transition-colors duration-100 truncate cursor-grab active:cursor-grabbing
                          ${draggedNote?.id === note.id
                            ? 'opacity-30'
                            : selected?.id === note.id
                            ? 'bg-[#2E7CD1]/15 text-[#2E7CD1]'
                            : 'text-[#C8C8C8] hover:text-white hover:bg-[#2A2A2A]'
                          }`}
                      >
                        {noteTitle(note)}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Sidebar footer */}
        <div className="mt-auto px-3 py-3 border-t border-[#2A2A2A] flex items-center gap-2">
          <a
            href="/settings"
            className="flex-1 text-left px-2 py-1.5 rounded-[4px] text-[12px] text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A] transition-colors duration-100"
          >
            Paramètres
          </a>
          <button
            onClick={handleLogout}
            className="px-2 py-1.5 rounded-[4px] text-[12px] text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A] transition-colors duration-100"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Zone principale */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#191919]">
        {/* Barre de recherche */}
        <div className="px-6 pt-4 pb-3 border-b border-[#2A2A2A] space-y-2.5 shrink-0">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060] pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher dans mon cerveau…"
                className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] pl-8 pr-4 py-[7px] text-[14px] placeholder-[#606060] text-[#D4D4D4] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100"
              />
            </div>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')}
              className="bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-3 py-[7px] text-[13px] text-[#9B9B9B] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100 hover:border-[#333] cursor-pointer"
            >
              <option value="all">Tout</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {getAllCategories().map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? null : cat as NoteCategory)}
                className={`px-2.5 py-[3px] rounded-[4px] text-[12px] border whitespace-nowrap transition-colors duration-100
                  ${filterCat === cat
                    ? getCatColor(cat)
                    : `bg-transparent ${CATEGORY_OUTLINE[cat as NoteCategory] || 'border-[#555]'} opacity-50 hover:opacity-90`
                  }`}
              >
                {getCatLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu — note ouverte ou liste */}
        {selected ? (
          <NoteDetail
            note={selected}
            onBack={() => setSelected(null)}
            onNoteUpdated={(updated) => {
              setSelected(updated);
              setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
              setAllNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
            }}
            onDeleteRequest={(id) => setConfirmDelete(id)}
            getCatColor={getCatColor}
            getCatLabel={getCatLabel}
            getAllCategories={getAllCategories}
          />
        ) : (
          <NoteList
            notes={notes}
            loading={loading}
            onSelect={openNote}
            onDeleteMulti={(ids) => { deleteNotes(ids); }}
            getCatColor={getCatColor}
            getCatLabel={getCatLabel}
          />
        )}
      </main>

      {/* Modale confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#252525] border border-[#2A2A2A] rounded-[8px] p-6 w-[340px] shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-[6px] bg-red-500/15 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#D4D4D4]">
                  Supprimer cette note ?
                </p>
                <p className="text-[12px] text-[#606060] mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-[13px] rounded-[4px] border border-[#2A2A2A] text-[#9B9B9B] hover:text-[#D4D4D4] hover:border-[#333] transition-colors duration-100"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  deleteNotes([confirmDelete as string]);
                }}
                className="px-4 py-2 text-[13px] rounded-[4px] bg-red-500 hover:bg-red-600 text-white font-medium transition-colors duration-100"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

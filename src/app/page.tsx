'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useUser } from '@/lib/hooks/useUser';
import { useRealtimeNotes } from '@/lib/hooks/useRealtimeNotes';
import { useCategories } from '@/lib/hooks/useCategories';
import type { Note, NoteCategory } from '@/lib/types';
import { NoteList } from '@/components/NoteList';
import { NoteDetail } from '@/components/NoteDetail';
import CategorySettings from '@/components/CategorySettings';
import { GraphView } from '@/components/GraphView';

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

type Section = 'new' | 'all' | 'recent' | 'graph' | string;

export default function BraynPage() {
  const router = useRouter();
  const { isAdmin, user } = useUser();
  const { categories, getCatLabel, getCatColor, refetch: refetchCategories } = useCategories();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [section, setSection] = useState<Section>('new');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandNewSection, setExpandNewSection] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [youtubeSyncing, setYoutubeSyncing] = useState(false);
  const [youtubeSyncResult, setYoutubeSyncResult] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6B7280');
  const [draggedNote, setDraggedNote] = useState<Note | null>(null);
  const [dragSourceCat, setDragSourceCat] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const deleteNotes = async (ids: string[]) => {
    await Promise.all(ids.map(id => fetch(`/api/notes/${id}`, { method: 'DELETE' })));
    setAllNotes(prev => prev.filter(n => !ids.includes(n.id)));
    setNotes(prev => prev.filter(n => !ids.includes(n.id)));
    if (selected && ids.includes(selected.id)) setSelected(null);
    setConfirmDelete(null);
  };

  const actionMenuRef = useRef<HTMLDivElement>(null);

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

  // Onboarding guard
  useEffect(() => {
    if (!user) return;
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(profile => {
        if (profile && !profile.onboarding_completed) {
          router.push('/onboarding');
        }
      })
      .catch(() => {});
  }, [user, router]);

  const fetchAllNotes = useCallback(async () => {
    const res = await fetch('/api/notes');
    const data = await res.json();
    setAllNotes(data);
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);

    // Use dedicated search endpoint for full-text queries
    if (debouncedSearch.trim()) {
      try {
        const res = await fetch(`/api/notes/search?q=${encodeURIComponent(debouncedSearch)}&limit=50`);
        const data = await res.json();
        setNotes(data);
      } catch {
        setNotes([]);
      }
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();

    if (section === 'new') params.set('seen', 'false');
    if (section === 'recent')
      params.set('from', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    if (section !== 'new' && section !== 'all' && section !== 'recent' && section !== 'settings' && section !== 'graph') {
      params.set('category', section);
    }
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
  }, [section, debouncedSearch, filterCat, filterPeriod]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    fetchAllNotes();
  }, [fetchAllNotes]);

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

  const getNewNotes = () => allNotes.filter(note => !note.seen);

  const openNote = async (note: Note) => {
    setSelected({ ...note, seen: true });

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

  const categoryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const toggleCategoryExpand = (cat: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
      const timer = categoryTimers.current.get(cat);
      if (timer) { clearTimeout(timer); categoryTimers.current.delete(cat); }
    } else {
      newExpanded.add(cat);
      const timer = setTimeout(() => {
        setExpandedCategories(prev => {
          const next = new Set(prev);
          next.delete(cat);
          return next;
        });
        categoryTimers.current.delete(cat);
      }, 15000);
      categoryTimers.current.set(cat, timer);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryNotes = (cat: string) =>
    allNotes.filter(note => (note.categories as string[]).includes(cat));

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

  const createCategory = async () => {
    if (!newCatLabel.trim()) return;
    const id = newCatLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        label: newCatLabel,
        color: newCatColor,
        description: '',
        ai_description: '',
        sort_order: categories.length,
        is_builtin: false,
        hidden: false,
      }),
    });
    setNewCatLabel('');
    setNewCatColor('#6B7280');
    setShowNewCatForm(false);
    await refetchCategories();
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

  const sidebarNavItem = (label: string, value: Section, icon: string) => {
    const isActive = section === value;
    return (
      <button
        key={value}
        onClick={() => { setSection(value); setSelected(null); }}
        className={`w-full text-left flex items-center gap-3 py-2 text-sm font-medium transition-colors duration-150 rounded-lg
          ${isActive
            ? 'pl-4 bg-[#ffcbd0]/15 text-[#ffcbd0] font-semibold'
            : 'pl-4 text-[#e4e2e4]/60 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
          }`}
      >
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        <span>{label}</span>
      </button>
    );
  };

  const newCount = getNewNotes().length;

  return (
    <div className="h-screen bg-[#191919] text-[#D4D4D4] flex overflow-hidden" style={{fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)"}}>
      {/* Sidebar */}
      <aside className="w-64 bg-[#1b1b1d] flex flex-col shrink-0 h-full">

        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#571c27] text-[16px]">terminal</span>
            </div>
            <span className="text-[15px] font-bold tracking-tighter text-[#e4e2e4]">Brayn</span>
          </div>

          <div className="relative" ref={actionMenuRef}>
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] text-[#571c27] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all duration-150"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nouvelle Note
            </button>

            {showActionMenu && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#1f1f21] rounded-xl shadow-[0px_20px_40px_rgba(0,0,0,0.4)] overflow-hidden z-50 border border-[#534344]/15">
                <button
                  onClick={() => { createEmptyNote(); setShowActionMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#e4e2e4]/80 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors whitespace-nowrap flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-[16px]">add_notes</span>
                  Créer une note
                </button>
                <button
                  onClick={() => { setShowActionMenu(false); setSection('settings'); setSelected(null); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#e4e2e4]/80 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors whitespace-nowrap flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  Gérer les catégories
                </button>
                {isAdmin && (
                  <button
                    onClick={syncYoutube}
                    disabled={youtubeSyncing}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#e4e2e4]/80 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors whitespace-nowrap flex items-center gap-3 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    {youtubeSyncing ? 'Sync en cours…' : 'Sync YouTube'}
                  </button>
                )}
              </div>
            )}
          </div>

          {youtubeSyncResult && (
            <p className="text-[11px] text-[#e4e2e4]/40 mt-2 px-1">{youtubeSyncResult}</p>
          )}
        </div>

        {/* Navigation principale */}
        <nav className="px-2 pb-2">
          <p className="text-[10px] uppercase tracking-widest text-[#e4e2e4]/30 font-bold px-3 pt-1 pb-2">Navigation</p>

          {/* Nouveaux — avec expand inline */}
          <div>
            <button
              onClick={() => { setExpandNewSection(!expandNewSection); setSection('new'); setSelected(null); }}
              className={`w-full text-left flex items-center gap-3 py-2 text-sm font-medium transition-colors duration-150 rounded-lg
                ${section === 'new'
                  ? 'pl-4 bg-[#ffcbd0]/15 text-[#ffcbd0] font-semibold'
                  : 'pl-4 text-[#e4e2e4]/60 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">add_notes</span>
              <span className="flex-1">Nouveaux</span>
              {newCount > 0 && (
                <span className="bg-[#ffcbd0] text-[#571c27] text-[9px] px-1.5 py-0.5 rounded-full font-bold tabular-nums mr-1">
                  {newCount}
                </span>
              )}
              <span className={`material-symbols-outlined text-[14px] text-[#e4e2e4]/30 mr-1 transition-transform duration-150 ${expandNewSection ? 'rotate-90' : ''}`}>
                chevron_right
              </span>
            </button>

            {expandNewSection && (
              <div className="pl-6 ml-2 border-l border-[#534344]/20 space-y-0.5 mt-0.5">
                {getNewNotes().length === 0 ? (
                  <p className="text-[11px] text-[#e4e2e4]/30 py-1.5 px-2">Aucune note</p>
                ) : (
                  getNewNotes().map(note => (
                    <button
                      key={note.id}
                      onClick={() => { setSection('new'); openNote(note); }}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition-colors duration-100 truncate
                        ${selected?.id === note.id
                          ? 'text-[#ffcbd0] font-medium'
                          : 'text-[#e4e2e4]/50 hover:text-[#e4e2e4]'
                        }`}
                    >
                      {noteTitle(note)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {sidebarNavItem('Tous', 'all', 'docs')}
          {sidebarNavItem('Graphe', 'graph', 'hub')}
        </nav>

        {/* Catégories — style explorateur Obsidian */}
        <div className="px-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <p className="text-[10px] uppercase tracking-widest text-[#e4e2e4]/30 font-bold px-3 pt-2 pb-2">Fichiers</p>

          {categories.map(cat => {
            const isExpanded = expandedCategories.has(cat.id);
            const categoryNotes = getCategoryNotes(cat.id);
            const isEditing = editingCatId === cat.id;
            const color = getCatColor(cat.id);

            const handleSave = async () => {
              if (!editingCatName.trim()) return;
              await fetch(`/api/categories/${cat.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: editingCatName }),
              });
              await refetchCategories();
              setEditingCatId(null);
            };

            const handleDelete = async () => {
              await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
              await refetchCategories();
            };

            return (
              <div key={cat.id}>
                {isEditing ? (
                  <div className="space-y-1.5 px-2 py-1.5">
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={e => setEditingCatName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      className="w-full bg-[#0e0e10] border-none rounded-lg px-3 py-1.5 text-sm text-[#e4e2e4] focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button onClick={handleSave} className="flex-1 bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] text-[#571c27] text-xs py-1.5 rounded-lg font-semibold">
                        Sauvegarder
                      </button>
                      <button onClick={() => setEditingCatId(null)} className="flex-1 bg-[#353437]/50 text-[#e4e2e4]/60 text-xs py-1.5 rounded-lg">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`group flex items-center rounded-lg transition-colors duration-150 ${
                      dragOverCat === cat.id && draggedNote && dragSourceCat !== cat.id
                        ? 'bg-[#ffcbd0]/10'
                        : 'hover:bg-[#353437]/50'
                    }`}
                    onDragOver={e => { e.preventDefault(); setDragOverCat(cat.id); }}
                    onDragLeave={() => setDragOverCat(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverCat(null);
                      if (!draggedNote || dragSourceCat === cat.id) return;
                      const newCats = (draggedNote.categories as string[]).filter(c => c !== dragSourceCat);
                      if (!newCats.includes(cat.id)) newCats.push(cat.id);
                      updateNoteCategories(draggedNote, newCats as NoteCategory[]);
                      setDraggedNote(null);
                      setDragSourceCat(null);
                    }}
                  >
                    <button
                      onClick={() => toggleCategoryExpand(cat.id)}
                      className="flex-1 text-left px-2 py-1.5 flex items-center gap-2"
                    >
                      <span className={`material-symbols-outlined text-[14px] text-[#e4e2e4]/30 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
                        chevron_right
                      </span>
                      <span className="material-symbols-outlined text-[16px]" style={{ color }}>
                        {isExpanded ? 'folder_open' : 'folder'}
                      </span>
                      <span className={`text-sm truncate transition-colors duration-100 ${isExpanded ? 'text-[#e4e2e4] font-medium' : 'text-[#e4e2e4]/60'}`}>
                        {cat.label}
                      </span>
                    </button>
                    <span className="text-[10px] text-[#555] pr-2 group-hover:hidden font-mono tabular-nums">{categoryNotes.length}</span>
                    <div className="hidden group-hover:flex items-center gap-1 pr-1.5">
                      <button
                        onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.label); }}
                        className="text-[#e4e2e4]/30 hover:text-[#e4e2e4] w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#353437] transition-colors"
                        title="Renommer"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="text-[#e4e2e4]/30 hover:text-red-400 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  </div>
                )}

                {isExpanded && !isEditing && (
                  <div className="pl-8 ml-1 border-l border-[#534344]/20 space-y-0.5 mt-0.5">
                    {categoryNotes.length === 0 ? (
                      <p className="text-[11px] text-[#e4e2e4]/30 py-1.5 px-2">Aucune note</p>
                    ) : (
                      categoryNotes.map(note => (
                        <button
                          key={note.id}
                          draggable
                          onDragStart={() => { setDraggedNote(note); setDragSourceCat(cat.id); }}
                          onDragEnd={() => { setDraggedNote(null); setDragSourceCat(null); setDragOverCat(null); }}
                          onClick={() => { setSection(cat.id as Section); openNote(note); }}
                          className={`w-full text-left px-2 py-1 rounded text-xs transition-colors duration-100 truncate cursor-grab active:cursor-grabbing
                            ${draggedNote?.id === note.id ? 'opacity-30' :
                              selected?.id === note.id ? 'text-[#ffcbd0] font-medium' :
                              'text-[#e4e2e4]/50 hover:text-[#e4e2e4]'
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

          {/* Formulaire nouvelle catégorie */}
          {showNewCatForm && (
            <div className="mt-2 space-y-2 px-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createCategory()}
                  placeholder="Nom de la catégorie…"
                  className="flex-1 bg-[#0e0e10] border-none rounded-lg px-3 py-1.5 text-sm text-[#e4e2e4] placeholder-[#e4e2e4]/30 focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40"
                  autoFocus
                />
              </div>
              <div className="flex gap-1.5 flex-wrap px-0.5">
                {['#3B82F6','#22C55E','#EF4444','#F59E0B','#A855F7','#EC4899','#06B6D4','#F97316','#8B5CF6','#10B981','#6B7280','#1D9BF0'].map(hex => (
                  <button
                    key={hex}
                    onClick={() => setNewCatColor(hex)}
                    className={`w-5 h-5 rounded-full transition-all ${newCatColor === hex ? 'ring-2 ring-offset-1 ring-offset-[#1b1b1d] ring-white scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={createCategory}
                  disabled={!newCatLabel.trim()}
                  className="flex-1 bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] text-[#571c27] text-xs py-1.5 rounded-lg font-semibold disabled:opacity-40"
                >
                  Créer
                </button>
                <button
                  onClick={() => { setShowNewCatForm(false); setNewCatLabel(''); setNewCatColor('#6B7280'); }}
                  className="flex-1 bg-[#353437]/50 text-[#e4e2e4]/60 text-xs py-1.5 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer sidebar */}
        <div className="shrink-0 px-2 py-3 flex items-center gap-1">
          <button
            onClick={() => { setSection('settings'); setSelected(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors duration-150
              ${section === 'settings'
                ? 'text-[#ffcbd0] bg-[#ffcbd0]/10'
                : 'text-[#e4e2e4]/40 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
              }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Catégories
          </button>
          <a
            href="/settings"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#e4e2e4]/40 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors duration-150"
          >
            <span className="material-symbols-outlined text-[16px]">person</span>
            Compte
          </a>
        </div>
      </aside>

      {/* Zone principale */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#131315]">
        {/* Barre de recherche */}
        <div className="px-6 pt-4 pb-3 space-y-2.5 shrink-0">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#e4e2e4]/30 pointer-events-none text-[18px]">search</span>
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  if (e.target.value.trim() && (section === 'graph' || section === 'settings')) {
                    setSection('all');
                  }
                }}
                placeholder="Rechercher dans mon cerveau…"
                className="w-full bg-[#0e0e10] border-none rounded-lg pl-10 pr-4 py-2 text-sm placeholder-[#e4e2e4]/30 text-[#e4e2e4] focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40 transition-all"
              />
            </div>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')}
              className="bg-[#0e0e10] border-none rounded-lg px-3 py-2 text-xs text-[#e4e2e4]/60 focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40 cursor-pointer"
            >
              <option value="all">Tout</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => {
              const isActive = filterCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-150
                    ${isActive
                      ? 'bg-[#ffcbd0]/15 text-[#ffcbd0] border border-[#ffcbd0]/30'
                      : 'bg-[#353437] text-[#e4e2e4]/50 hover:text-[#e4e2e4] hover:bg-[#353437]/80'
                    }`}
                >
                  {getCatLabel(cat.id)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu — settings, note ouverte ou liste */}
        {section === 'graph' ? (
          <GraphView
            getCatColor={getCatColor}
            getCatLabel={getCatLabel}
            onSelectNote={(noteId) => {
              const note = allNotes.find(n => n.id === noteId);
              if (note) {
                setSection('all');
                openNote(note);
              }
            }}
          />
        ) : section === 'settings' ? (
          <CategorySettings
            onClose={() => setSection('all')}
            onCategoriesChanged={() => refetchCategories()}
          />
        ) : selected ? (
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
            getAllCategories={() => categories.map(c => c.id)}
            onOpenRelated={(noteId) => {
              const rn = allNotes.find(n => n.id === noteId);
              if (rn) openNote(rn);
            }}
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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1f1f21] rounded-2xl p-6 w-[340px] shadow-[0px_20px_40px_rgba(0,0,0,0.4)] border border-[#534344]/15">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-400 text-[18px]">delete</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e4e2e4]">Supprimer cette note ?</p>
                <p className="text-xs text-[#e4e2e4]/40 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-[#353437]/50 text-[#e4e2e4]/70 hover:text-[#e4e2e4] text-sm py-2 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteNotes([confirmDelete])}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm py-2 rounded-xl transition-colors font-semibold"
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

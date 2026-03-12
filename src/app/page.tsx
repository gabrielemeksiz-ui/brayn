'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Note, NoteCategory } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';
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
  const [expandedCategories, setExpandedCategories] = useState<Set<NoteCategory | string>>(new Set());
  const [expandNewSection, setExpandNewSection] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);

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

  const getNewNotes = () => {
    return notes.filter(note => !note.seen);
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

        setNotes(prev =>
          prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n)),
        );
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
    return notes.filter(note =>
      (note.categories as (NoteCategory | string)[]).includes(cat),
    );
  };

  const createEmptyNote = async () => {
    try {
      const res = await fetch('/api/notes/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ' ', source: 'desktop' }),
      });

      if (res.ok) {
        setShowActionMenu(false);
        fetchNotes();
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const createNewCategory = async () => {
    if (!newCategoryName.trim()) return;

    const newCat = newCategoryName.toLowerCase().replace(/\s+/g, '_');
    if (customCategories.includes(newCat)) return;

    setCustomCategories([...customCategories, newCat]);
    setNewCategoryName('');
    setShowNewCategoryForm(false);
    setShowActionMenu(false);
  };

  const getAllCategories = (): (NoteCategory | string)[] => {
    return [...ALL_CATEGORIES, ...customCategories];
  };

  const sidebarItem = (label: string, value: Section, badge?: number) => (
    <button
      key={value}
      onClick={() => setSection(value)}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between
        ${section === value ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full font-mono">
          {badge}
        </span>
      )}
    </button>
  );

  const newCount = getNewNotes().length;

  return (
    <div className="h-screen bg-[#0e0e0e] text-white flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-[#141414] border-r border-white/5 flex flex-col p-3 gap-1 shrink-0">
        <div className="space-y-2 mb-3 relative">
          <div className="flex items-center justify-between px-2 py-3">
            <h1 className="text-lg font-bold tracking-tight text-white">🧠 Brayn</h1>
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="text-zinc-400 hover:text-white text-lg leading-none transition-all"
            >
              +
            </button>
          </div>
          {showActionMenu && (
            <div className="absolute top-14 right-2 bg-[#0e0e0e] border border-white/10 rounded-lg shadow-lg overflow-hidden z-50">
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
                onClick={() => setShowNewCategoryForm(true)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg_WHITE/5 transition-all whitespace-nowrap border-t border-white/5"
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
                onKeyDown={e => e.key === 'Enter' && createNewCategory()}
                placeholder="Nom de la catégorie…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                autoFocus
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
                  }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-400 text-xs py-1.5 rounded-lg transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-zinc-600 px-2 py-1 uppercase tracking-widest">
          Vues
        </div>

        {/* Expandable "Nouveaux" section */}
        <div className="space-y-1">
          <button
            onClick={() => setExpandNewSection(!expandNewSection)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between
              ${section === 'new' ? 'bg-white/10 text_WHITE' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-2 flex-1">
              <span className="text-xs">{expandNewSection ? '▼' : '▶'}</span>
              Nouveaux
            </span>
            {newCount > 0 && (
              <span className="bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full font-mono">
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

        <div className="text-xs text-zinc-600 px-2 py-1 uppercase tracking-widest mt-3">
          Catégories
        </div>
        {getAllCategories().map(cat => {
          const isExpanded = expandedCategories.has(cat);
          const categoryNotes = getCategoryNotes(cat);
          const label = CATEGORY_LABELS[cat as NoteCategory] || cat;
          return (
            <div key={cat} className="space-y-1">
              <button
                onClick={() => toggleCategoryExpand(cat)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <span className="flex items-center gap-2 flex-1">
                  <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                  {label}
                </span>
                <span className="text-xs text-zinc-600">{categoryNotes.length}</span>
              </button>
              {isExpanded && (
                <div className="pl-6 space-y-1 max-h-48 overflow-y-auto">
                  {categoryNotes.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-2">Aucune note</p>
                  ) : (
                    categoryNotes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => openNote(note)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all truncate
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
          );
        })}
      </aside>

      {/* Zone centrale */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Barre de recherche */}
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans mon cerveau…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-zinc-500 text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all"
            />
            <select
              value={filterPeriod}
              onChange={e =>
                setFilterPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')
              }
              className="bg-white/5 border border_WHITE/10 rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all hover:border-white/20 cursor-pointer"
            >
              <option value="all">Tout</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all
                  ${
                    filterCat === cat
                      ? CATEGORY_COLORS[cat]
                      : 'bg-transparent text-zinc-500 border-white/10 hover:border-white/20'
                  }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && <p className="text-zinc-500 text-sm p-4">Chargement…</p>}
          {!loading && notes.length === 0 && (
            <p className="text-zinc-500 text-sm p-4">Aucune note ici.</p>
          )}
          {notes.map(note => (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all hover:border-white/20
                ${
                  selected?.id === note.id
                    ? 'border-indigo-500/40 bg-indigo-500/5'
                    : 'border-white/5 bg-white/2 hover:bg-white/4'
                }
                ${!note.seen ? 'border-l-2 border-l-indigo-400' : ''}`}
            >
              <div className="flex items-start gap-2 mb-1.5">
                {!note.seen && (
                  <span className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                )}
                <p className="text-sm text-zinc-200 line-clamp-2 leading-relaxed flex-1">
                  {note.clean_original_language ?? note.original_text}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-zinc-600">
                  {formatDate(note.created_at)}
                </span>
                {note.categories.map(cat => (
                  <span
                    key={cat}
                    className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </span>
                ))}
                {note.source === 'telegram' && (
                  <span className="text-xs text-zinc-600 ml-auto">✈️ TG</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Panneau détail */}
      {selected && (
        <aside className="w-96 bg-[#141414] border-l border-white/5 overflow-y-auto p-5 space-y-5 shrink-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600 font-mono">
                {selected.id.slice(0, 8)}…
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-zinc-600 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-zinc-500">{formatDate(selected.created_at)}</p>

            <div className="flex gap-1.5 flex-wrap">
              {selected.categories.map(cat => (
                <span
                  key={cat}
                  className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}
                >
                  {CATEGORY_LABELS[cat]}
                </span>
              ))}
            </div>

            {selected.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {selected.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg_white/5 text-zinc-400 border border-white/10"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {selected.links.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-zinc-600 uppercase tracking-wider">Liens</p>
                {selected.links.map(link => (
                  <a
                    key={link}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-indigo-400 hover:text-indigo-300 truncate"
                  >
                    {link}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-zinc-600 uppercase tracking-wider">Texte</p>
            <div className="bg-white/3 rounded-lg p-3 border border-white/5">
              <NoteEditor
                noteId={selected.id}
                initialFullText={
                  selected.full_text ??
                  [
                    `ID: ${selected.id}`,
                    `DATE: ${formatDate(selected.created_at)}`,
                    '',
                    'RAW TEXT',
                    selected.original_text,
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
        </aside>
      )}
    </div>
  );
}

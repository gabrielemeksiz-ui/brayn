'use client';

import { useState } from 'react';
import type { Note } from '@/lib/types';
import { formatDate } from '@/lib/utils';

function noteTitle(note: Note): string {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  const isTweet =
    note.links?.some(l => tweetRegex.test(l)) ||
    tweetRegex.test(note.original_text ?? '');
  if (isTweet) return note.clean_original_language ?? note.original_text ?? '';
  return note.original_text ?? '';
}

function noteSnippet(note: Note): string {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  const isTweet =
    note.links?.some(l => tweetRegex.test(l)) ||
    tweetRegex.test(note.original_text ?? '');
  if (isTweet) return '';
  return note.clean_original_language ?? '';
}

interface NoteListProps {
  notes: Note[];
  loading: boolean;
  onSelect: (note: Note) => void;
  onDeleteMulti: (ids: string[]) => void;
  getCatColor: (cat: string) => string;
  getCatLabel: (cat: string) => string;
}

export function NoteList({
  notes,
  loading,
  onSelect,
  onDeleteMulti,
  getCatColor,
  getCatLabel,
}: NoteListProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    onDeleteMulti(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <p className="text-sm text-[#e4e2e4]/30">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-[#e4e2e4]/30 font-bold">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Supprimer ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors
                ${selectMode
                  ? 'bg-[#ffcbd0]/15 text-[#ffcbd0]'
                  : 'text-[#e4e2e4]/40 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
                }`}
            >
              {selectMode ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>
        </div>

        {/* Liste */}
        {notes.length === 0 ? (
          <p className="text-sm text-[#d8c1c3]/40 pt-12 text-center">Aucune note</p>
        ) : (
          <div className="space-y-1">
            {notes.map(note => {
              const isChecked = selectedIds.has(note.id);
              const snippet = noteSnippet(note);
              return (
                <div
                  key={note.id}
                  onClick={() => selectMode ? toggleId(note.id) : onSelect(note)}
                  className={`group flex items-start gap-3 w-full text-left p-6 rounded-xl transition-all duration-150 cursor-pointer border
                    ${isChecked
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-[#1b1b1d] border-[#2a2a2c] hover:border-[#ffcbd0]/20 hover:bg-[#1f1f21]'
                    }`}
                >
                  {selectMode && (
                    <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors
                      ${isChecked ? 'bg-red-500 border-red-500' : 'border-[#534344]'}`}
                    >
                      {isChecked && (
                        <span className="material-symbols-outlined text-white text-[12px]" style={{fontVariationSettings:"'FILL' 1"}}>check</span>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-lg font-semibold text-[#e4e2e4] truncate group-hover:text-[#ffcbd0] transition-colors duration-150">
                        {noteTitle(note)}
                      </p>
                    </div>
                    {snippet && (
                      <p className="text-sm text-[#d8c1c3] line-clamp-1 mb-3">{snippet}</p>
                    )}
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-[11px] font-medium text-[#e4e2e4]/30 uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                        {formatDate(note.created_at)}
                      </span>
                      {note.categories.slice(0, 2).map(cat => (
                        <span
                          key={cat}
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#353437] text-[#d8c1c3]"
                        >
                          {getCatLabel(cat)}
                        </span>
                      ))}
                      {!note.seen && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#ffcbd0] ml-auto">Nouveau</span>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#e4e2e4]/10 group-hover:text-[#ffcbd0]/30 transition-colors shrink-0 mt-0.5">more_vert</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

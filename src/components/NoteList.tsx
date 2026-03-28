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
        <div className="max-w-[900px] mx-auto px-8 py-6">
          <p className="text-[#606060] text-[14px]">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-8 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-[#9B9B9B]">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[13px] bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors duration-100"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Supprimer ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 rounded-[4px] text-[13px] border transition-colors duration-100
                ${selectMode
                  ? 'bg-[#2E7CD1]/15 border-[#2E7CD1]/30 text-[#2E7CD1]'
                  : 'bg-transparent border-[#2A2A2A] text-[#9B9B9B] hover:text-[#D4D4D4] hover:border-[#333]'
                }`}
            >
              {selectMode ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>
        </div>

        {/* List */}
        {notes.length === 0 ? (
          <p className="text-[#606060] text-[14px]">Aucune note</p>
        ) : (
          <div className="space-y-1">
            {notes.map(note => {
              const isChecked = selectedIds.has(note.id);
              return (
                <div
                  key={note.id}
                  onClick={() => selectMode ? toggleId(note.id) : onSelect(note)}
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-[6px] border transition-colors duration-100 cursor-pointer group
                    ${isChecked
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-[#252525] hover:bg-[#2A2A2A] border-[#2A2A2A] hover:border-[#333]'
                    }`}
                >
                  {selectMode && (
                    <div className={`w-4 h-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors duration-100
                      ${isChecked ? 'bg-red-500 border-red-500' : 'border-[#444]'}`}
                    >
                      {isChecked && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 6 5 9 10 3"/>
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-[#D4D4D4] truncate group-hover:text-white transition-colors duration-100">
                      {noteTitle(note)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[12px] text-[#9B9B9B]">{formatDate(note.created_at)}</span>
                      {note.categories.slice(0, 2).map(cat => (
                        <span key={cat} className={`text-[11px] px-1.5 py-[1px] rounded-[4px] border ${getCatColor(cat)}`}>
                          {getCatLabel(cat)}
                        </span>
                      ))}
                      {!note.seen && (
                        <span className="text-[11px] text-[#2E7CD1] font-medium">Nouveau</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

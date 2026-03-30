'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note, NoteCategory } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { NoteEditor } from '@/components/NoteEditor';
import { TweetEmbed } from '@/components/TweetEmbed';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

function extractTweetUrls(links: string[], originalText: string): string[] {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/gi;
  const fromLinks = links.filter(l => /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i.test(l));
  if (fromLinks.length > 0) return fromLinks;
  return [...originalText.matchAll(tweetRegex)].map(m => m[0]);
}

function extractYoutubeUrls(links: string[] | null): string[] {
  return (links ?? []).filter(l => /https?:\/\/(www\.)?youtube\.com\/watch\?v=/.test(l));
}

function noteTitle(note: Note): string {
  const isTweet = extractTweetUrls(note.links ?? [], note.original_text ?? '').length > 0;
  if (isTweet) return note.clean_original_language ?? note.original_text ?? '';
  return note.original_text ?? '';
}

interface NoteDetailProps {
  note: Note;
  onBack: () => void;
  onNoteUpdated: (note: Note) => void;
  onDeleteRequest: (id: string) => void;
  getCatColor: (cat: string) => string;
  getCatLabel: (cat: string) => string;
  getAllCategories: () => (NoteCategory | string)[];
}

export function NoteDetail({
  note,
  onBack,
  onNoteUpdated,
  onDeleteRequest,
  getCatColor,
  getCatLabel,
  getAllCategories,
}: NoteDetailProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [tweetText, setTweetText] = useState<string | null>(null);

  const [classifying, setClassifying] = useState(false);

  // Reset local state when note changes
  useEffect(() => {
    setTweetText(null);
    setChatMessages([]);
    setChatInput('');
    setShowChat(false);
    setEditingTitle(false);
  }, [note.id]);

  // Load chat history when note opens
  useEffect(() => {
    fetch(`/api/notes/${note.id}/chat`)
      .then(r => r.json())
      .then(data => setChatMessages(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [note.id]);

  const saveTitle = useCallback(async () => {
    if (!titleValue.trim()) return;
    const newTitle = titleValue.trim();
    setEditingTitle(false);
    const updated = { ...note, original_text: newTitle };
    onNoteUpdated(updated);
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_text: newTitle }),
    });
  }, [note, titleValue, onNoteUpdated]);

  const updateNoteCategories = async (newCategories: NoteCategory[]) => {
    const updated = { ...note, categories: newCategories };
    onNoteUpdated(updated);
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: newCategories }),
    });
  };

  const handleClassifyWithAI = async () => {
    setClassifying(true);
    onNoteUpdated({ ...note, ai_status: 'processing' });
    try {
      const res = await fetch('/api/notes/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: note.id }),
      });
      const data = await res.json();
      if (data.note) onNoteUpdated(data.note);
    } catch {
      onNoteUpdated({ ...note, ai_status: 'failed' });
    } finally {
      setClassifying(false);
    }
  };

  const tweetUrls = extractTweetUrls(note.links ?? [], note.original_text ?? '');
  const youtubeUrls = extractYoutubeUrls(note.links);

  const editorInitialText = (() => {
    const isTweet = tweetUrls.length > 0;
    if (isTweet) return tweetText ?? note.full_text ?? '';
    const fullText = note.full_text ?? note.clean_original_language ?? note.original_text ?? '';
    if (youtubeUrls.length > 0) {
      return fullText.replace(/^🔗 https?:\/\/[^\n]+\n\n/, '');
    }
    return fullText;
  })();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-[900px] mx-auto px-8 pt-6 pb-16">

          {/* AI Status Banner (QW3) */}
          {note.ai_status === 'processing' && (
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[13px]">
              <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Classification IA en cours…
            </div>
          )}
          {note.ai_status === 'failed' && (
            <div className="mb-4 flex items-center justify-between gap-2 px-4 py-2.5 rounded-[6px] bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              <span>Erreur lors de la classification IA.</span>
              <button
                onClick={handleClassifyWithAI}
                disabled={classifying}
                className="text-[12px] underline hover:no-underline disabled:opacity-50"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Top actions */}
          <div className="flex justify-end items-center gap-2 mb-6">
            {/* QW2: Classify with AI button */}
            {note.source === 'desktop' && note.ai_status === 'pending' && (
              <button
                onClick={handleClassifyWithAI}
                disabled={classifying}
                className="bg-[#353437] text-[#d8c1c3] rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#2a2a2c] hover:text-[#e4e2e4] disabled:opacity-40 transition-colors duration-100"
              >
                <span className="material-symbols-outlined" style={{fontSize: '14px'}}>sell</span>
                Classer avec l&apos;IA
              </button>
            )}

            <button
              onClick={() => setShowChat(v => !v)}
              className={`transition-colors duration-100 ${showChat
                ? 'bg-[#ffcbd0]/10 text-[#ffcbd0] border border-[#ffcbd0]/20 rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5'
                : 'bg-[#353437] text-[#d8c1c3] rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#2a2a2c]'
              }`}
            >
              <span className="material-symbols-outlined" style={{fontSize: '14px'}}>chat</span>
              Chat IA
              {chatMessages.length > 0 && (
                <span className="text-[10px] bg-[#ffcbd0]/20 text-[#ffcbd0] rounded-full px-1.5 py-0.5 font-mono tabular-nums">
                  {chatMessages.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onDeleteRequest(note.id)}
              className="bg-red-500/10 text-red-400 rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-500/20 transition-colors duration-100"
              title="Supprimer cette note"
            >
              <span className="material-symbols-outlined" style={{fontSize: '14px'}}>delete</span>
              Supprimer
            </button>

            <button
              onClick={onBack}
              className="bg-[#353437] text-[#d8c1c3] rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#2a2a2c] hover:text-[#e4e2e4] transition-colors duration-100"
            >
              <span className="material-symbols-outlined" style={{fontSize: '14px'}}>close</span>
              Fermer
            </button>
          </div>

          {/* Title */}
          <div className="mb-4">
            {/* Metadata badge */}
            <div className="mb-3">
              <span className="bg-[#2a2a2c] text-[#d8c1c3]/60 text-[10px] tracking-widest uppercase px-2 py-1 rounded">
                {note.source} · {formatDate(note.created_at)}
              </span>
            </div>

            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="w-full bg-transparent text-4xl font-extrabold tracking-tighter text-[#e4e2e4] mb-4 leading-snug focus:outline-none border-b border-[#ffcbd0]/40 pb-1"
                autoFocus
              />
            ) : (
              <h1
                className="text-4xl font-extrabold tracking-tighter text-[#e4e2e4] leading-snug cursor-text hover:text-white transition-colors duration-100"
                onClick={() => {
                  setEditingTitle(true);
                  setTitleValue(note.original_text ?? '');
                  setTimeout(() => titleInputRef.current?.select(), 30);
                }}
                title="Cliquer pour modifier le titre"
              >
                {noteTitle(note)}
              </h1>
            )}

            <div className="flex items-center gap-2 flex-wrap mt-8">
              {note.categories.map(cat => (
                <span
                  key={cat}
                  className="bg-[#353437] text-[#d8c1c3] text-xs uppercase rounded px-2 py-0.5 flex items-center"
                >
                  {getCatLabel(cat)}
                  <button
                    onClick={() => updateNoteCategories(note.categories.filter(c => c !== cat) as NoteCategory[])}
                    className="text-[#d8c1c3]/50 hover:text-[#e4e2e4] ml-1 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                value=""
                onChange={e => {
                  const cat = e.target.value as NoteCategory;
                  if (cat && !note.categories.includes(cat)) {
                    updateNoteCategories([...note.categories, cat] as NoteCategory[]);
                  }
                }}
                className="bg-[#0e0e10] border-none rounded-lg text-xs text-[#d8c1c3] focus:ring-1 focus:ring-[#ffcbd0]/30 focus:outline-none cursor-pointer px-2 py-0.5 transition-colors duration-100"
              >
                <option value="">+ Catégorie</option>
                {getAllCategories()
                  .filter(c => !note.categories.includes(c as NoteCategory))
                  .map(cat => (
                    <option key={cat} value={cat}>{getCatLabel(cat)}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Tweet Embed */}
          {tweetUrls.length > 0 && (
            <div className="mb-6 space-y-3">
              {tweetUrls.map(url => (
                <TweetEmbed key={url} url={url} onData={d => setTweetText(d.text)} />
              ))}
            </div>
          )}

          {/* YouTube Link */}
          {youtubeUrls.length > 0 && (
            <div className="mb-4 flex flex-col gap-1">
              {youtubeUrls.map(url => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#2E7CD1] hover:underline break-all"
                >
                  {url}
                </a>
              ))}
            </div>
          )}

          {/* Editor */}
          <NoteEditor noteId={note.id} initialFullText={editorInitialText} />
        </div>
      </div>

      {/* Chat IA panel */}
      {showChat && (
        <div className="h-[320px] shrink-0 border-t border-[#2A2A2A] flex flex-col bg-[#191919]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2A2A2A] shrink-0">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2E7CD1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-[13px] font-medium text-[#D4D4D4]">Chat IA</span>
              <span className="text-[12px] text-[#606060]">— réfléchissons ensemble</span>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="text-[#606060] hover:text-[#D4D4D4] w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-[#2A2A2A] transition-colors duration-100 text-base leading-none"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <p className="text-[13px] text-[#606060] text-center pt-6">Pose une question sur cette note…</p>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-[6px] text-[13px] leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-[#2E7CD1] text-white rounded-br-[2px]'
                      : 'bg-[#252525] text-[#D4D4D4] border border-[#2A2A2A] rounded-bl-[2px]'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#252525] border border-[#2A2A2A] rounded-[6px] rounded-bl-[2px] px-3 py-2">
                  <span className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-[#2A2A2A] shrink-0">
            <form
              onSubmit={async e => {
                e.preventDefault();
                const msg = chatInput.trim();
                if (!msg || chatLoading) return;
                const optimistic: ChatMessage = {
                  id: Date.now().toString(),
                  role: 'user',
                  content: msg,
                  created_at: new Date().toISOString(),
                };
                setChatMessages(prev => [...prev, optimistic]);
                setChatInput('');
                setChatLoading(true);
                setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                try {
                  const res = await fetch(`/api/notes/${note.id}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg }),
                  });
                  const data = await res.json();
                  const reply: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.reply ?? 'Erreur',
                    created_at: new Date().toISOString(),
                  };
                  setChatMessages(prev => [...prev, reply]);
                } catch {
                  setChatMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Erreur de connexion.',
                    created_at: new Date().toISOString(),
                  }]);
                } finally {
                  setChatLoading(false);
                  setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Écris ton message…"
                disabled={chatLoading}
                className="flex-1 bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-3 py-2 text-[13px] text-[#D4D4D4] placeholder-[#606060] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#2E7CD1] hover:bg-[#2568B8] text-white px-3 py-2 rounded-[4px] text-[13px] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

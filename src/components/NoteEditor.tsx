"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NoteEditorProps = {
  noteId: string;
  initialFullText?: string | null;
};

export function NoteEditor({ noteId, initialFullText }: NoteEditorProps) {
  const [text, setText] = useState(initialFullText ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Quand on change de note, on remet le texte initial
  useEffect(() => {
    setText(initialFullText ?? "");
    setLastSavedAt(null);
  }, [noteId, initialFullText]);

  const saveContent = useCallback(
    async (value: string) => {
      try {
        setIsSaving(true);

        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_text: value,
          }),
        });

        if (!res.ok) {
          console.error("Failed to save note", await res.text());
          return;
        }

        setLastSavedAt(new Date());
      } catch (err) {
        console.error("Error while saving note", err);
      } finally {
        setIsSaving(false);
      }
    },
    [noteId],
  );

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (text === (initialFullText ?? "")) {
      return;
    }

    saveTimeoutRef.current = setTimeout(() => {
      void saveContent(text);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [text, initialFullText, saveContent]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {isSaving
            ? "Enregistrement…"
            : lastSavedAt
            ? `Enregistré à ${lastSavedAt.toLocaleTimeString()}`
            : "Prêt"}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-80 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 resize-none focus:outline-none focus:border-indigo-500/60"
        placeholder="Tape ton texte ici…"
      />
    </div>
  );
}

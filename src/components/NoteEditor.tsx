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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [text]);

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
      <div className="flex items-center justify-between text-xs text-neutral-500 shrink-0">
        <span>
          {isSaving
            ? "Enregistrement…"
            : lastSavedAt
            ? `Enregistré à ${lastSavedAt.toLocaleTimeString()}`
            : "Prêt"}
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full bg-transparent border-none px-0 py-0 text-[15px] text-zinc-300 resize-none focus:outline-none leading-8 placeholder-zinc-700 overflow-hidden min-h-[200px]"
        placeholder="Commence à écrire…"
      />
    </div>
  );
}

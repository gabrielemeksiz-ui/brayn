'use client';

import { useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { Note } from '@/lib/types';

interface UseRealtimeNotesOptions {
  userId: string | undefined;
  onInsert: (note: Note) => void;
  onUpdate: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

export function useRealtimeNotes({
  userId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeNotesOptions): void {
  const stableInsert = useCallback(onInsert, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stableUpdate = useCallback(onUpdate, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stableDelete = useCallback(onDelete, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel('notes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => stableInsert(payload.new as Note),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => stableUpdate(payload.new as Note),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => stableDelete((payload.old as { id: string }).id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, stableInsert, stableUpdate, stableDelete]);
}

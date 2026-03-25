'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient as createBrowserClient } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

interface UseUserResult {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();
        setIsAdmin(profile?.is_admin ?? false);
      }

      setLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsAdmin(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isAdmin, loading };
}

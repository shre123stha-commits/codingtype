import { useCallback, useEffect } from 'react';

import { authAvailable, supabase } from '../utils/supabase.js';
import { useGameStore } from '../store/gameStore.js';

// Syncs the Supabase auth session into the game store and exposes
// signIn / signUp / signOut. With no Supabase config, authAvailable is
// false and every action is a no-op returning a hint.
export function useAuth() {
  const setAuthUser = useGameStore((s) => s.setAuthUser);
  const authUser = useGameStore((s) => s.authUser);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (live) setAuthUser(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthUser(session?.user?.email ?? null);
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, [setAuthUser]);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: 'ACCOUNTS ARE NOT CONFIGURED' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    setAuthUser(data.user?.email ?? email);
    return { error: null, session: Boolean(data.session) };
  }, [setAuthUser]);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) return { error: 'ACCOUNTS ARE NOT CONFIGURED' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    setAuthUser(data.user?.email ?? email);
    // Supabase may require email confirmation — no session yet in that case
    return { error: null, session: Boolean(data.session), needsConfirm: !data.session };
  }, [setAuthUser]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthUser(null);
  }, [setAuthUser]);

  return { authAvailable, authUser, signIn, signUp, signOut };
}

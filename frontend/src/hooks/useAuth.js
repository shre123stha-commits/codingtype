import { useCallback, useEffect } from 'react';

import { authAvailable, getSupabase, hasStoredSession } from '../utils/supabase.js';
import { pushProfile, syncProfileForSession } from '../utils/profileCloud.js';
import { useGameStore } from '../store/gameStore.js';

// Syncs the Supabase auth session into the game store and exposes
// signIn / signUp / signOut. The display name + photo (device profile) are
// mirrored to the cloud profiles row when a session exists. With no Supabase
// config, authAvailable is false and every action is a no-op returning a hint.
//
// The SDK itself is code-split: a guest (no persisted session) never triggers
// the dynamic import, so the 208 kB client stays out of their download.
export function useAuth() {
  const setAuthUser = useGameStore((s) => s.setAuthUser);
  const authUser = useGameStore((s) => s.authUser);

  useEffect(() => {
    if (!authAvailable || !hasStoredSession()) return undefined;
    let live = true;
    let unsubscribe = null;

    getSupabase().then((supabase) => {
      if (!live || !supabase) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!live) return;
        setAuthUser(data.session?.user?.email ?? null);
        if (data.session) syncProfileForSession();
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        setAuthUser(session?.user?.email ?? null);
        syncProfileForSession(); // no-op when there is no session
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      live = false;
      if (unsubscribe) unsubscribe();
    };
  }, [setAuthUser]);

  const signIn = useCallback(
    async (email, password, name) => {
      const supabase = await getSupabase();
      if (!supabase) return { error: 'ACCOUNTS ARE NOT CONFIGURED' };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      setAuthUser(data.user?.email ?? email);
      // let the session sync settle first, then apply an optional rename
      await syncProfileForSession();
      const st = useGameStore.getState();
      const n = (name || '').trim();
      if (n && n !== st.profileName) {
        st.setProfile({ name: n });
        pushProfile(n, st.profileAvatar);
      }
      return { error: null, session: Boolean(data.session) };
    },
    [setAuthUser]
  );

  const signUp = useCallback(
    async (email, password, name) => {
      const supabase = await getSupabase();
      if (!supabase) return { error: 'ACCOUNTS ARE NOT CONFIGURED' };
      const n = (name || '').trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: n || null } }
      });
      if (error) return { error: error.message };
      setAuthUser(data.user?.email ?? email);
      if (n) useGameStore.getState().setProfile({ name: n });
      // Supabase may require email confirmation — no session yet in that case
      if (data.session) await syncProfileForSession();
      return { error: null, session: Boolean(data.session), needsConfirm: !data.session };
    },
    [setAuthUser]
  );

  const signOut = useCallback(async () => {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthUser(null);
    // device profile stays in the store/localStorage for guest use
  }, [setAuthUser]);

  return { authAvailable, authUser, signIn, signUp, signOut };
}

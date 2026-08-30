// Operator profile sync (display name + photo) for the Supabase cloud.
//
// The profile always lives in the game store + localStorage first (device
// profile — works for guests with no account). When signed in, it is
// mirrored to a public.profiles row (one per user, RLS-protected). Cloud
// values win on login; if the cloud row is missing/empty the device values
// are pushed up.
import { authAvailable, getSupabase, hasStoredSession } from './supabase.js';
import { useGameStore } from '../store/gameStore.js';

let syncing = null; // mutex so overlapping session events don't race

async function currentUser() {
  // Never pulls the SDK in for a guest — see utils/supabase.js.
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user || null;
  } catch {
    return null;
  }
}

export async function pullProfile() {
  const user = await currentUser();
  if (!user) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar')
      .eq('id', user.id)
      .maybeSingle();
    if (!data) return null;
    return { name: data.display_name || '', avatar: data.avatar || null };
  } catch {
    return null; // profiles table not created yet / offline — device profile stays
  }
}

export async function pushProfile(name, avatar) {
  const user = await currentUser();
  if (!user) return;
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: name || null,
          avatar: avatar || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
  } catch {
    /* best effort — the device profile already has it */
  }
}

// Merge cloud + device profile into the store after any session change.
export function syncProfileForSession() {
  // A guest has nothing to sync; bailing here (synchronously) is what keeps
  // the Supabase SDK out of a guest's download entirely.
  if (!authAvailable || !hasStoredSession()) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const cloud = await pullProfile();
      const st = useGameStore.getState();
      if (!cloud) {
        if (st.profileName || st.profileAvatar) await pushProfile(st.profileName, st.profileAvatar);
        return;
      }
      const name = cloud.name || st.profileName;
      const avatar = cloud.avatar || st.profileAvatar;
      if (name !== st.profileName || avatar !== st.profileAvatar) st.setProfile({ name, avatar });
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

// What the top bar / cards should show for the current user.
export function displayName(profileName, authUser) {
  if (profileName) return profileName;
  if (authUser) return String(authUser).split('@')[0];
  return 'GUEST';
}

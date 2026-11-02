import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isBackendConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { getProfile, type Profile } from '@/services/profile';

interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isBackendConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [storedProfile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!isBackendConfigured) return;
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => mounted && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try {
      setProfile(await getProfile(userId));
    } catch (err) {
      console.warn('Falha ao carregar perfil', err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getProfile(userId).then(
      (p) => active && setProfile(p),
      (err) => console.warn('Falha ao carregar perfil', err),
    );
    return () => {
      active = false;
    };
  }, [userId]);

  // Perfil de outro usuário (após trocar de conta) nunca é exposto.
  const profile = storedProfile && storedProfile.id === userId ? storedProfile : null;

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ ready, session, profile, refreshProfile, setProfile, signOut }),
    [ready, session, profile, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}

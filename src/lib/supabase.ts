import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isBackendConfigured } from './env';

// Cliente público: usa somente a chave publicável. As regras de acesso são
// garantidas pelo RLS no banco e pelas Edge Functions.
export const supabase = createClient<Database>(
  isBackendConfigured ? SUPABASE_URL : 'https://not-configured.invalid',
  isBackendConfigured ? SUPABASE_PUBLISHABLE_KEY : 'not-configured',
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// Em apps nativos, renova o token só com o app em primeiro plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

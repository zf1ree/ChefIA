// Variáveis públicas do app (prefixo EXPO_PUBLIC_). NUNCA coloque chaves
// privadas aqui: tudo que começa com EXPO_PUBLIC_ é embutido no app.

export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'ChefIA';
export const APP_TAGLINE = 'Seu Chef Inteligente';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

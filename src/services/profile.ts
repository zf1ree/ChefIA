import { supabase } from '@/lib/supabase';
import type { Database, Tables } from '@/lib/database.types';

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  | 'display_name'
  | 'allergies'
  | 'dietary_restrictions'
  | 'disliked_ingredients'
  | 'cuisine_preferences'
  | 'pantry_staples'
  | 'max_cooking_minutes'
  | 'default_servings'
>;

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single();
  if (error) throw error;
  return data;
}

export async function setImageConsent(userId: string, granted: boolean): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ image_processing_consent_at: granted ? new Date().toISOString() : null })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export interface Usage {
  plan: 'free' | 'premium';
  scan: { used: number; quota: number };
  recipes: { used: number; quota: number };
}

export async function getUsage(): Promise<Usage | null> {
  const { data, error } = await supabase.rpc('get_ai_usage');
  if (error) throw error;
  if (!data?.length) return null;
  const scan = data.find((d) => d.kind === 'scan');
  const recipes = data.find((d) => d.kind === 'recipes');
  return {
    plan: data[0].plan,
    scan: { used: scan?.used ?? 0, quota: scan?.quota ?? 0 },
    recipes: { used: recipes?.used ?? 0, quota: recipes?.quota ?? 0 },
  };
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}

/** Itens básicos sugeridos (o usuário confirma quais tem). */
export const STAPLE_SUGGESTIONS = [
  'Sal',
  'Óleo de cozinha',
  'Azeite',
  'Açúcar',
  'Pimenta-do-reino',
  'Alho',
  'Cebola',
  'Vinagre',
  'Orégano',
  'Farinha de trigo',
  'Manteiga',
  'Arroz',
];

export const CUISINE_OPTIONS = ['Brasileira', 'Caseira', 'Italiana', 'Mexicana', 'Asiática', 'Árabe', 'Mediterrânea', 'Saudável'];

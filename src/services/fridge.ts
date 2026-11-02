import { normalizeName } from '@shared/normalize';
import type { StorageLocation } from '@shared/schemas';

import { supabase } from '@/lib/supabase';
import type { Database, Tables } from '@/lib/database.types';

export type FridgeItem = Tables<'user_ingredients'>;
export type FridgeItemInput = Pick<
  Database['public']['Tables']['user_ingredients']['Insert'],
  'name' | 'quantity' | 'category' | 'location' | 'expires_on' | 'notes' | 'source' | 'ingredient_id'
>;

export async function listFridge(): Promise<FridgeItem[]> {
  const { data, error } = await supabase
    .from('user_ingredients')
    .select('*')
    .order('expires_on', { ascending: true, nullsFirst: false })
    .order('name');
  if (error) throw error;
  return data;
}

export async function getFridgeItem(id: string): Promise<FridgeItem> {
  const { data, error } = await supabase.from('user_ingredients').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createFridgeItem(input: FridgeItemInput): Promise<FridgeItem> {
  const { data, error } = await supabase.from('user_ingredients').insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateFridgeItem(id: string, patch: Partial<FridgeItemInput>): Promise<FridgeItem> {
  const { data, error } = await supabase.from('user_ingredients').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteFridgeItem(id: string): Promise<void> {
  const { error } = await supabase.from('user_ingredients').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Adiciona vários itens (ex.: vindos de uma análise), ignorando os que já
 * existem no mesmo local com o mesmo nome. Retorna quantos foram adicionados.
 */
export async function addManyToFridge(
  items: { name: string; quantity?: string | null; category: string; location: StorageLocation; expires_on?: string | null }[],
  source: FridgeItemInput['source'],
): Promise<number> {
  const existing = await listFridge();
  const keys = new Set(existing.map((e) => `${e.location}:${normalizeName(e.name)}`));
  const toInsert = items
    .filter((i) => {
      const key = `${i.location}:${normalizeName(i.name)}`;
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    })
    .map((i) => ({
      name: i.name.trim(),
      quantity: i.quantity ?? null,
      category: i.category,
      location: i.location,
      expires_on: i.expires_on ?? null,
      source,
    }));
  if (!toInsert.length) return 0;
  const { error } = await supabase.from('user_ingredients').insert(toInsert);
  if (error) throw error;
  return toInsert.length;
}

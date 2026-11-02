import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type CatalogIngredient = Tables<'ingredients'>;

let cache: CatalogIngredient[] | null = null;

/** O catálogo é pequeno e público: carregamos uma vez e filtramos localmente. */
export async function getCatalog(): Promise<CatalogIngredient[]> {
  if (cache) return cache;
  const { data, error } = await supabase.from('ingredients').select('*').order('name');
  if (error) throw error;
  cache = data;
  return data;
}

export function filterCatalog(items: CatalogIngredient[], query: string): CatalogIngredient[] {
  const q = query
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  if (!q) return items;
  return items.filter((i) =>
    i.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .includes(q),
  );
}

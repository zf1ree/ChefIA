import { normalizeName } from '@shared/normalize';

import { categoryLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type ShoppingItem = Tables<'shopping_list_items'>;

/** MVP: uma lista por usuário, criada sob demanda. */
async function ensureListId(): Promise<string> {
  const { data, error } = await supabase.from('shopping_lists').select('id').order('created_at').limit(1).maybeSingle();
  if (error) throw error;
  if (data) return data.id;
  const { data: created, error: insErr } = await supabase.from('shopping_lists').insert({}).select('id').single();
  if (insErr) throw insErr;
  return created.id;
}

export async function listShoppingItems(): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('*')
    .order('checked')
    .order('category')
    .order('name');
  if (error) throw error;
  return data;
}

export interface NewShoppingItem {
  name: string;
  quantity?: string | null;
  category?: string;
  recipeTitle?: string;
}

/**
 * Adiciona itens evitando duplicidade (nome normalizado). Se o item já
 * existe, junta a receita de origem e volta a marcá-lo como pendente.
 * Retorna quantos itens novos foram criados.
 */
export async function addShoppingItems(items: NewShoppingItem[]): Promise<number> {
  if (!items.length) return 0;
  const listId = await ensureListId();
  const existing = await listShoppingItems();
  const byKey = new Map(existing.map((e) => [e.normalized_name, e]));
  let created = 0;

  for (const item of items) {
    const key = normalizeName(item.name);
    if (!key) continue;
    const current = byKey.get(key);
    if (current) {
      const titles = item.recipeTitle && !current.recipe_titles.includes(item.recipeTitle)
        ? [...current.recipe_titles, item.recipeTitle]
        : current.recipe_titles;
      const { data, error } = await supabase
        .from('shopping_list_items')
        .update({ recipe_titles: titles, checked: false })
        .eq('id', current.id)
        .select('*')
        .single();
      if (error) throw error;
      byKey.set(key, data);
    } else {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .insert({
          list_id: listId,
          name: item.name.trim(),
          normalized_name: key,
          quantity: item.quantity ?? null,
          category: item.category ?? 'outros',
          recipe_titles: item.recipeTitle ? [item.recipeTitle] : [],
        })
        .select('*')
        .single();
      if (error) throw error;
      byKey.set(key, data);
      created++;
    }
  }
  return created;
}

export async function setChecked(id: string, checked: boolean): Promise<void> {
  const { error } = await supabase.from('shopping_list_items').update({ checked }).eq('id', id);
  if (error) throw error;
}

export async function removeShoppingItem(id: string): Promise<void> {
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
  if (error) throw error;
}

export async function clearChecked(): Promise<void> {
  const { error } = await supabase.from('shopping_list_items').delete().eq('checked', true);
  if (error) throw error;
}

export function shoppingShareText(items: ShoppingItem[]): string {
  const pending = items.filter((i) => !i.checked);
  const groups = new Map<string, ShoppingItem[]>();
  for (const i of pending) {
    const k = categoryLabel(i.category);
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const lines = ['🛒 Lista de compras'];
  for (const [cat, list] of groups) {
    lines.push('', `${cat}:`);
    for (const i of list) lines.push(`☐ ${i.name}${i.quantity ? ` — ${i.quantity}` : ''}`);
  }
  lines.push('', 'Criada com ChefIA.');
  return lines.join('\n');
}

import { RankedRecipeSchema, type StoredRecipe } from '@shared/schemas';

import { supabase } from '@/lib/supabase';

export interface RecipeSummary {
  id: string;
  title: string;
  meal_type: string | null;
  difficulty: string | null;
  total_minutes: number | null;
  servings: number | null;
  created_at: string;
}

const SUMMARY = 'id, title, meal_type, difficulty, total_minutes, servings, created_at';

export async function getRecipe(id: string): Promise<StoredRecipe> {
  const { data, error } = await supabase.from('recipes').select('id, data').eq('id', id).single();
  if (error) throw error;
  const parsed = RankedRecipeSchema.parse(data.data);
  return { ...parsed, id: data.id };
}

export async function listGeneratedRecipes(limit = 50): Promise<RecipeSummary[]> {
  const { data, error } = await supabase.from('recipes').select(SUMMARY).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function listFavorites(): Promise<RecipeSummary[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select(`created_at, recipes(${SUMMARY})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((f) => f.recipes).filter((r): r is RecipeSummary => !!r);
}

export async function isFavorite(recipeId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('favorites')
    .select('recipe_id', { count: 'exact', head: true })
    .eq('recipe_id', recipeId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function setFavorite(recipeId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    const { error } = await supabase.from('favorites').upsert({ recipe_id: recipeId }, { onConflict: 'user_id,recipe_id', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('favorites').delete().eq('recipe_id', recipeId);
    if (error) throw error;
  }
}

export interface CookedEntry {
  id: string;
  cooked_at: string;
  recipe: RecipeSummary;
}

export async function markCooked(recipeId: string): Promise<void> {
  const { error } = await supabase.from('cooking_history').insert({ recipe_id: recipeId });
  if (error) throw error;
}

export async function listCooked(): Promise<CookedEntry[]> {
  const { data, error } = await supabase
    .from('cooking_history')
    .select(`id, cooked_at, recipes(${SUMMARY})`)
    .order('cooked_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data
    .filter((d) => d.recipes)
    .map((d) => ({ id: d.id, cooked_at: d.cooked_at, recipe: d.recipes as RecipeSummary }));
}

export async function timesCooked(recipeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('cooking_history')
    .select('id', { count: 'exact', head: true })
    .eq('recipe_id', recipeId);
  if (error) throw error;
  return count ?? 0;
}

export interface Feedback {
  rating: number;
  worked: boolean | null;
  comment: string | null;
}

export async function getFeedback(recipeId: string): Promise<Feedback | null> {
  const { data, error } = await supabase
    .from('recipe_feedback')
    .select('rating, worked, comment')
    .eq('recipe_id', recipeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveFeedback(recipeId: string, fb: Feedback): Promise<void> {
  const { error } = await supabase
    .from('recipe_feedback')
    .upsert({ recipe_id: recipeId, ...fb }, { onConflict: 'user_id,recipe_id' });
  if (error) throw error;
}

export function recipeShareText(r: StoredRecipe): string {
  const lines = [
    `🍽️ ${r.title}`,
    r.description,
    '',
    `⏱️ ${r.prep_minutes + r.cook_minutes} min · ${r.servings} porções`,
    '',
    'Ingredientes:',
    ...r.ingredients.map((i) => `• ${i.display_quantity} ${i.name}${i.optional ? ' (opcional)' : ''}`),
    '',
    'Modo de preparo:',
    ...r.steps.map((s, idx) => `${idx + 1}. ${s.text}`),
    '',
    'Receita gerada com ChefIA.',
  ];
  return lines.join('\n');
}

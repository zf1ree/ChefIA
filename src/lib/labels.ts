import type { Ionicons } from '@expo/vector-icons';

import type { Category, Difficulty, MealType, RecipeTag, StorageLocation } from '@shared/schemas';

type IconName = keyof typeof Ionicons.glyphMap;

export const CATEGORY_LABELS: Record<Category, string> = {
  hortifruti: 'Hortifrúti',
  laticinios: 'Laticínios',
  carnes: 'Carnes',
  peixes: 'Peixes',
  ovos: 'Ovos',
  graos: 'Grãos e massas',
  padaria: 'Padaria',
  temperos: 'Temperos e básicos',
  molhos: 'Molhos',
  enlatados: 'Enlatados',
  congelados: 'Congelados',
  bebidas: 'Bebidas',
  doces: 'Doces',
  outros: 'Outros',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  hortifruti: '🥬',
  laticinios: '🧀',
  carnes: '🥩',
  peixes: '🐟',
  ovos: '🥚',
  graos: '🌾',
  padaria: '🍞',
  temperos: '🧂',
  molhos: '🥫',
  enlatados: '🥫',
  congelados: '🧊',
  bebidas: '🥤',
  doces: '🍫',
  outros: '🧺',
};

export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c as Category] ?? 'Outros';
}

export function categoryEmoji(c: string): string {
  return CATEGORY_EMOJI[c as Category] ?? '🧺';
}

export const LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Geladeira',
  freezer: 'Congelador',
  pantry: 'Despensa',
};

export const LOCATION_ICONS: Record<StorageLocation, IconName> = {
  fridge: 'snow-outline',
  freezer: 'cube-outline',
  pantry: 'file-tray-stacked-outline',
};

export const MEAL_LABELS: Record<MealType, string> = {
  cafe_da_manha: 'Café da manhã',
  almoco: 'Almoço',
  jantar: 'Jantar',
  lanche: 'Lanche',
  sobremesa: 'Sobremesa',
};

export const MEAL_EMOJI: Record<MealType, string> = {
  cafe_da_manha: '🍳',
  almoco: '🍲',
  jantar: '🍝',
  lanche: '🥪',
  sobremesa: '🍮',
};

export const TAG_LABELS: Record<RecipeTag, string> = {
  rapida: 'Rápida',
  economica: 'Econômica',
  fitness: 'Fitness',
  vegetariana: 'Vegetariana',
  vegana: 'Vegana',
  proteica: 'Rica em proteína',
  poucos_ingredientes: 'Poucos ingredientes',
  infantil: 'Para crianças',
  sobras: 'Aproveitar sobras',
  refeicao_completa: 'Refeição completa',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  media: 'Média',
  dificil: 'Difícil',
};

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** "25/12/2026" -> "2026-12-25"; retorna null se inválida. */
export function parseDateBR(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

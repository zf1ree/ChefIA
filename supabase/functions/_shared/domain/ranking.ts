// Classificação das receitas pelo que o usuário realmente tem em casa.
// A disponibilidade é calculada AQUI, no servidor, e não confiada à IA.
import { isExpiringSoon } from './expiry.ts';
import { covers, findCovering } from './normalize.ts';
import type { AIRecipe, InventoryItem, MissingItem, RankedRecipe, ShoppingMode } from './schemas.ts';

export interface RankingContext {
  inventory: readonly InventoryItem[];
  /** Itens básicos que o usuário CONFIRMOU ter (sal, óleo...). */
  confirmedStaples: readonly string[];
  today: string;
}

/**
 * Tiers:
 * 1 — só com o que tem (+ básicos confirmados)
 * 2 — falta 1 ingrediente
 * 3 — faltam poucos (2–3)
 * 4 — faltam mais, mas aproveita itens perto do vencimento
 * null — descartada (faltam muitos e não aproveita nada que vence)
 */
export function tierFor(missingRequired: number, usesExpiring: number): RankedRecipe['tier'] | null {
  if (missingRequired === 0) return 1;
  if (missingRequired === 1) return 2;
  if (missingRequired <= 3) return 3;
  if (usesExpiring > 0) return 4;
  return null;
}

export function maxMissingFor(mode: ShoppingMode): number {
  switch (mode) {
    case 'none':
      return 0;
    case 'one':
      return 1;
    case 'few':
      return 3;
    case 'any':
      return Number.POSITIVE_INFINITY;
  }
}

export function assessRecipe(recipe: AIRecipe, ctx: RankingContext): RankedRecipe | null {
  const inventoryNames = ctx.inventory.map((i) => i.name);
  const expiringNames = ctx.inventory.filter((i) => isExpiringSoon(i.expires_on, ctx.today)).map((i) => i.name);

  const have: string[] = [];
  const missing: MissingItem[] = [];
  const usesExpiring = new Set<string>();
  let fromInventory = 0;

  for (const ing of recipe.ingredients) {
    // A IA indica qual item do inventário usou; só aceitamos se ele existir de fato.
    const claimed =
      ing.matched_inventory_item &&
      inventoryNames.find((n) => covers(n, ing.matched_inventory_item!) && covers(ing.matched_inventory_item!, n));
    const owned = claimed || findCovering(inventoryNames, ing.name);
    const staple = !owned && findCovering(ctx.confirmedStaples, ing.name);

    if (owned) {
      fromInventory++;
      have.push(ing.name);
      const exp = expiringNames.find((e) => covers(e, owned) && covers(owned, e));
      if (exp) usesExpiring.add(exp);
    } else if (staple) {
      have.push(ing.name);
    } else {
      missing.push({ name: ing.name, display_quantity: ing.display_quantity, optional: ing.optional });
    }
  }

  // Precisa usar pelo menos um item do inventário: não aceitamos receitas genéricas.
  if (fromInventory === 0) return null;

  const missingRequired = missing.filter((m) => !m.optional).length;
  const tier = tierFor(missingRequired, usesExpiring.size);
  if (tier === null) return null;

  return { ...recipe, have, missing, uses_expiring: [...usesExpiring], tier };
}

export interface RankOptions {
  shopping: ShoppingMode;
  prioritizeExpiring: boolean;
  maxMinutes?: number | null;
}

export function totalMinutes(r: Pick<AIRecipe, 'prep_minutes' | 'cook_minutes'>): number {
  return r.prep_minutes + r.cook_minutes;
}

export function rankRecipes(recipes: readonly RankedRecipe[], opts: RankOptions): RankedRecipe[] {
  const maxMissing = maxMissingFor(opts.shopping);
  const filtered = recipes.filter((r) => {
    const missingRequired = r.missing.filter((m) => !m.optional).length;
    if (missingRequired > maxMissing) return false;
    // Tolerância de 20% para estimativas de tempo da IA.
    if (opts.maxMinutes && totalMinutes(r) > opts.maxMinutes * 1.2) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (opts.prioritizeExpiring && a.uses_expiring.length !== b.uses_expiring.length) {
      return b.uses_expiring.length - a.uses_expiring.length;
    }
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.uses_expiring.length !== b.uses_expiring.length) return b.uses_expiring.length - a.uses_expiring.length;
    if (a.have.length !== b.have.length) return b.have.length - a.have.length;
    return totalMinutes(a) - totalMinutes(b);
  });
}

export const TIER_LABELS: Record<RankedRecipe['tier'], string> = {
  1: 'Dá pra fazer agora',
  2: 'Falta 1 ingrediente',
  3: 'Faltam poucos ingredientes',
  4: 'Aproveita o que vai vencer',
};

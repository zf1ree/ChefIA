// Validação e pós-processamento das respostas da IA (puro e testável).
import { dedupeNames } from './normalize.ts';
import { assessRecipe, rankRecipes, type RankingContext, type RankOptions } from './ranking.ts';
import { checkRecipeSafety } from './safety.ts';
import {
  AIRecipeSchema,
  AIRecipesOutputSchema,
  VisionOutputSchema,
  type AIRecipe,
  type DetectedIngredient,
  type ImageIssue,
  type RankedRecipe,
} from './schemas.ts';

/** Abaixo disso o item é descartado; entre os limites, pede confirmação. */
export const MIN_CONFIDENCE = 0.35;
export const CONFIRM_BELOW = 0.7;

export interface ProcessedVision {
  image: { usable: boolean; issue: ImageIssue; message: string };
  ingredients: DetectedIngredient[];
  notes: string | null;
}

export class InvalidAIOutputError extends Error {}

export function processVisionOutput(raw: unknown): ProcessedVision {
  const parsed = VisionOutputSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidAIOutputError(parsed.error.message);
  const out = parsed.data;

  const ingredients = dedupeNames(
    out.ingredients
      .filter((i) => i.confidence >= MIN_CONFIDENCE)
      .map((i) => ({ ...i, name: capitalize(i.name.trim()) }))
      .sort((a, b) => b.confidence - a.confidence),
  ).map<DetectedIngredient>((i) => ({
    name: i.name,
    category: i.category,
    quantity_estimate: i.quantity_estimate?.trim() || null,
    confidence: Math.round(i.confidence * 100) / 100,
    needs_confirmation: i.confidence < CONFIRM_BELOW,
    location_hint: i.location_hint,
  }));

  // Imagem "utilizável" sem nenhum alimento confiável = pedir nova foto.
  let image = out.image_quality;
  if (image.usable && ingredients.length === 0) {
    image = {
      usable: false,
      issue: image.issue === 'none' ? 'no_food' : image.issue,
      message: 'Não consegui identificar alimentos com segurança. Tente uma foto mais próxima e bem iluminada.',
    };
  }
  return { image, ingredients: image.usable ? ingredients : [], notes: out.notes };
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1) : s;
}

export interface ProcessedRecipes {
  recipes: RankedRecipe[];
  removedForSafety: number;
  removedInvalid: number;
  notes: string | null;
}

export function processRecipesOutput(
  raw: unknown,
  ctx: RankingContext,
  opts: RankOptions,
  safetyKeys: readonly string[],
): ProcessedRecipes {
  const outer = AIRecipesOutputSchema.safeParse(raw);
  if (!outer.success) throw new InvalidAIOutputError(outer.error.message);

  let removedForSafety = 0;
  let removedInvalid = 0;
  const assessed: RankedRecipe[] = [];
  const seenTitles = new Set<string>();

  for (const candidate of outer.data.recipes) {
    const parsed = AIRecipeSchema.safeParse(candidate);
    if (!parsed.success || !isCoherent(parsed.data)) {
      removedInvalid++;
      continue;
    }
    const titleKey = parsed.data.title.trim().toLowerCase();
    if (seenTitles.has(titleKey)) {
      removedInvalid++;
      continue;
    }

    if (!checkRecipeSafety(parsed.data.ingredients.map((i) => i.name), safetyKeys).safe) {
      removedForSafety++;
      continue;
    }
    // Substituições que violem restrições são removidas (a receita continua válida).
    const recipe = {
      ...parsed.data,
      substitutions: parsed.data.substitutions.filter(
        (s) => checkRecipeSafety([s.substitute], safetyKeys).safe,
      ),
    };

    const ranked = assessRecipe(recipe, ctx);
    if (!ranked) {
      removedInvalid++;
      continue;
    }
    seenTitles.add(titleKey);
    assessed.push(ranked);
  }

  return { recipes: rankRecipes(assessed, opts), removedForSafety, removedInvalid, notes: outer.data.notes };
}

/** Checagens de coerência além do schema. */
export function isCoherent(r: AIRecipe): boolean {
  if (r.prep_minutes + r.cook_minutes <= 0) return false;
  const stepMinutes = r.steps.reduce((acc, s) => acc + (s.minutes ?? 0), 0);
  // Soma dos passos não pode ultrapassar muito o tempo total declarado.
  if (stepMinutes > (r.prep_minutes + r.cook_minutes) * 1.5 + 10) return false;
  const names = r.ingredients.map((i) => i.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return false;
  return true;
}

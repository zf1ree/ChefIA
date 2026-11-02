import { InvalidAIOutputError, processRecipesOutput, processVisionOutput } from '@shared/pipeline';
import { maxMissingFor, tierFor } from '@shared/ranking';
import type { AIRecipe } from '@shared/schemas';

function recipe(overrides: Partial<AIRecipe> = {}): AIRecipe {
  return {
    title: 'Omelete de queijo',
    description: 'Omelete simples e rápida.',
    meal_type: 'cafe_da_manha',
    tags: ['rapida'],
    difficulty: 'facil',
    prep_minutes: 5,
    cook_minutes: 5,
    servings: 2,
    ingredients: [
      { name: 'Ovos', quantity: 4, unit: 'unidade', display_quantity: '4 unidades', matched_inventory_item: 'Ovo', optional: false, is_basic_staple: false },
      { name: 'Queijo muçarela', quantity: 50, unit: 'g', display_quantity: '50 g', matched_inventory_item: 'Queijo', optional: false, is_basic_staple: false },
      { name: 'Sal', quantity: null, unit: null, display_quantity: 'a gosto', matched_inventory_item: null, optional: false, is_basic_staple: true },
    ],
    steps: [
      { text: 'Bata os ovos com o sal.', minutes: 2 },
      { text: 'Cozinhe em frigideira e adicione o queijo.', minutes: 5 },
    ],
    nutrition_per_serving: { calories: 250, protein_g: 18, carbs_g: 2, fat_g: 18 },
    substitutions: [],
    side_suggestions: [],
    allergen_notes: null,
    ...overrides,
  };
}

const ctx = {
  inventory: [
    { name: 'Ovo', quantity: '6 unidades', expires_on: null },
    { name: 'Queijo', quantity: null, expires_on: null },
    { name: 'Tomate', quantity: null, expires_on: '2026-10-11' },
  ],
  confirmedStaples: [] as string[],
  today: '2026-10-10',
};
const opts = { shopping: 'few' as const, prioritizeExpiring: false, maxMinutes: null };

describe('processVisionOutput', () => {
  const base = {
    image_quality: { usable: true, issue: 'none', message: 'ok' },
    ingredients: [
      { name: 'ovo', category: 'ovos', quantity_estimate: '6 unidades', confidence: 0.95, location_hint: 'fridge' },
      { name: 'Ovos', category: 'ovos', quantity_estimate: null, confidence: 0.6, location_hint: null },
      { name: 'Iogurte', category: 'laticinios', quantity_estimate: null, confidence: 0.5, location_hint: 'fridge' },
      { name: 'Pote misterioso', category: 'outros', quantity_estimate: null, confidence: 0.2, location_hint: null },
    ],
    notes: null,
  };

  it('filtra baixa confiança, deduplica e pede confirmação', () => {
    const out = processVisionOutput(base);
    expect(out.ingredients.map((i) => i.name)).toEqual(['Ovo', 'Iogurte']);
    expect(out.ingredients[0].needs_confirmation).toBe(false);
    expect(out.ingredients[1].needs_confirmation).toBe(true);
  });

  it('imagem sem alimentos confiáveis vira pedido de nova foto', () => {
    const out = processVisionOutput({ ...base, ingredients: [base.ingredients[3]] });
    expect(out.image.usable).toBe(false);
    expect(out.image.issue).toBe('no_food');
    expect(out.ingredients).toEqual([]);
  });

  it('imagem inutilizável não devolve ingredientes', () => {
    const out = processVisionOutput({ ...base, image_quality: { usable: false, issue: 'too_dark', message: 'Escura' } });
    expect(out.ingredients).toEqual([]);
  });

  it('rejeita saída fora do contrato', () => {
    expect(() => processVisionOutput({ foo: 1 })).toThrow(InvalidAIOutputError);
    expect(() =>
      processVisionOutput({ ...base, ingredients: [{ ...base.ingredients[0], category: 'inventada' }] }),
    ).toThrow(InvalidAIOutputError);
  });
});

describe('processRecipesOutput', () => {
  it('não presume sal sem confirmação', () => {
    const out = processRecipesOutput({ recipes: [recipe()], notes: null }, ctx, opts, []);
    expect(out.recipes[0].missing.map((m) => m.name)).toEqual(['Sal']);
    expect(out.recipes[0].tier).toBe(2);
  });

  it('com sal confirmado, a receita vai para o tier 1', () => {
    const out = processRecipesOutput({ recipes: [recipe()], notes: null }, { ...ctx, confirmedStaples: ['Sal'] }, opts, []);
    expect(out.recipes[0].missing).toEqual([]);
    expect(out.recipes[0].tier).toBe(1);
  });

  it('ignora "matched_inventory_item" inventado pela IA', () => {
    const r = recipe({
      title: 'Frango',
      ingredients: [
        { name: 'Frango', quantity: 300, unit: 'g', display_quantity: '300 g', matched_inventory_item: 'Frango', optional: false, is_basic_staple: false },
        { name: 'Ovo', quantity: 1, unit: 'unidade', display_quantity: '1 unidade', matched_inventory_item: 'Ovo', optional: false, is_basic_staple: false },
      ],
    });
    const out = processRecipesOutput({ recipes: [r], notes: null }, ctx, opts, []);
    expect(out.recipes[0].missing.map((m) => m.name)).toEqual(['Frango']);
    expect(out.recipes[0].have).toEqual(['Ovo']);
  });

  it('descarta receitas que violam alergias e remove substituições inseguras', () => {
    const safe = recipe({
      title: 'Ovos mexidos',
      ingredients: [recipe().ingredients[0]],
      substitutions: [
        { ingredient: 'Ovo', substitute: 'Manteiga', note: 'x' },
        { ingredient: 'Ovo', substitute: 'Azeite', note: 'y' },
      ],
    });
    const out = processRecipesOutput({ recipes: [recipe(), safe], notes: null }, ctx, opts, ['leite']);
    expect(out.removedForSafety).toBe(1);
    expect(out.recipes.map((r) => r.title)).toEqual(['Ovos mexidos']);
    expect(out.recipes[0].substitutions.map((s) => s.substitute)).toEqual(['Azeite']);
  });

  it('descarta receitas inválidas, incoerentes, duplicadas ou que não usam o inventário', () => {
    const generic = recipe({
      title: 'Bolo',
      ingredients: [
        { name: 'Farinha', quantity: 200, unit: 'g', display_quantity: '200 g', matched_inventory_item: null, optional: false, is_basic_staple: false },
      ],
    });
    const incoherent = recipe({ title: 'Rápida demais', prep_minutes: 1, cook_minutes: 1, steps: [{ text: 'Asse por muito tempo.', minutes: 120 }, { text: 'Sirva quente.', minutes: null }] });
    const out = processRecipesOutput(
      { recipes: [recipe(), recipe(), { title: 'x' }, generic, incoherent], notes: null },
      ctx,
      opts,
      [],
    );
    expect(out.recipes).toHaveLength(1);
    expect(out.removedInvalid).toBe(4);
  });

  it('modo "sem mercado" só aceita receitas completas', () => {
    const out = processRecipesOutput({ recipes: [recipe()], notes: null }, ctx, { ...opts, shopping: 'none' }, []);
    expect(out.recipes).toHaveLength(0);
  });

  it('respeita tempo máximo com tolerância de 20%', () => {
    const slow = recipe({ title: 'Lenta', prep_minutes: 10, cook_minutes: 30 });
    const out = processRecipesOutput({ recipes: [slow, recipe()], notes: null }, ctx, { ...opts, maxMinutes: 15 }, []);
    expect(out.recipes.map((r) => r.title)).toEqual(['Omelete de queijo']);
  });

  it('prioriza receitas que usam itens perto do vencimento', () => {
    const tomato = recipe({
      title: 'Ovos com tomate',
      ingredients: [
        ...recipe().ingredients.slice(0, 1),
        { name: 'Tomate', quantity: 2, unit: 'unidade', display_quantity: '2 unidades', matched_inventory_item: 'Tomate', optional: false, is_basic_staple: false },
        { name: 'Cebola', quantity: 1, unit: 'unidade', display_quantity: '1 unidade', matched_inventory_item: null, optional: false, is_basic_staple: false },
      ],
    });
    const out = processRecipesOutput(
      { recipes: [recipe(), tomato], notes: null },
      { ...ctx, confirmedStaples: ['Sal'] },
      { ...opts, prioritizeExpiring: true },
      [],
    );
    expect(out.recipes[0].title).toBe('Ovos com tomate');
    expect(out.recipes[0].uses_expiring).toEqual(['Tomate']);
    expect(out.recipes[1].tier).toBe(1);
  });

  it('rejeita payload sem a lista de receitas', () => {
    expect(() => processRecipesOutput({ nope: true }, ctx, opts, [])).toThrow(InvalidAIOutputError);
  });
});

describe('tiers', () => {
  it('classifica pela quantidade de itens faltando', () => {
    expect(tierFor(0, 0)).toBe(1);
    expect(tierFor(1, 0)).toBe(2);
    expect(tierFor(3, 0)).toBe(3);
    expect(tierFor(5, 1)).toBe(4);
    expect(tierFor(5, 0)).toBeNull();
    expect(maxMissingFor('one')).toBe(1);
  });
});

// JSON Schemas enviados ao modelo (modo estrito: tudo em `required`,
// opcionais como união com null, additionalProperties: false).
// Devem permanecer equivalentes aos schemas Zod em domain/schemas.ts.
import { CATEGORIES, DIFFICULTIES, IMAGE_ISSUES, LOCATIONS, MEAL_TYPES, RECIPE_TAGS } from '../domain/schemas.ts';

const str = { type: 'string' } as const;
const nullableStr = { type: ['string', 'null'] } as const;
const int = { type: 'integer' } as const;
const nullableInt = { type: ['integer', 'null'] } as const;
const num = { type: 'number' } as const;
const bool = { type: 'boolean' } as const;

function obj(properties: Record<string, unknown>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

export const visionSchema = obj({
  image_quality: obj({
    usable: bool,
    issue: { type: 'string', enum: [...IMAGE_ISSUES] },
    message: str,
  }),
  ingredients: {
    type: 'array',
    items: obj({
      name: str,
      category: { type: 'string', enum: [...CATEGORIES] },
      quantity_estimate: nullableStr,
      confidence: num,
      location_hint: { type: ['string', 'null'], enum: [...LOCATIONS, null] },
    }),
  },
  notes: nullableStr,
});

export const recipesSchema = obj({
  recipes: {
    type: 'array',
    items: obj({
      title: str,
      description: str,
      meal_type: { type: 'string', enum: [...MEAL_TYPES] },
      tags: { type: 'array', items: { type: 'string', enum: [...RECIPE_TAGS] } },
      difficulty: { type: 'string', enum: [...DIFFICULTIES] },
      prep_minutes: int,
      cook_minutes: int,
      servings: int,
      ingredients: {
        type: 'array',
        items: obj({
          name: str,
          quantity: { type: ['number', 'null'] },
          unit: nullableStr,
          display_quantity: str,
          matched_inventory_item: nullableStr,
          optional: bool,
          is_basic_staple: bool,
        }),
      },
      steps: { type: 'array', items: obj({ text: str, minutes: nullableInt }) },
      nutrition_per_serving: {
        anyOf: [obj({ calories: num, protein_g: num, carbs_g: num, fat_g: num }), { type: 'null' }],
      },
      substitutions: { type: 'array', items: obj({ ingredient: str, substitute: str, note: str }) },
      side_suggestions: { type: 'array', items: str },
      allergen_notes: nullableStr,
    }),
  },
  notes: nullableStr,
});

// Contratos de dados (Zod) compartilhados entre app e backend.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enumerações
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  'hortifruti',
  'laticinios',
  'carnes',
  'peixes',
  'ovos',
  'graos',
  'padaria',
  'temperos',
  'molhos',
  'enlatados',
  'congelados',
  'bebidas',
  'doces',
  'outros',
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

export const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const;
export const LocationSchema = z.enum(LOCATIONS);
export type StorageLocation = z.infer<typeof LocationSchema>;

export const MEAL_TYPES = ['cafe_da_manha', 'almoco', 'jantar', 'lanche', 'sobremesa'] as const;
export const MealTypeSchema = z.enum(MEAL_TYPES);
export type MealType = z.infer<typeof MealTypeSchema>;

export const RECIPE_TAGS = [
  'rapida',
  'economica',
  'fitness',
  'vegetariana',
  'vegana',
  'proteica',
  'poucos_ingredientes',
  'infantil',
  'sobras',
  'refeicao_completa',
] as const;
export const RecipeTagSchema = z.enum(RECIPE_TAGS);
export type RecipeTag = z.infer<typeof RecipeTagSchema>;

export const DIFFICULTIES = ['facil', 'media', 'dificil'] as const;
export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const IMAGE_ISSUES = ['none', 'too_dark', 'blurry', 'no_food', 'too_far', 'obstructed', 'other'] as const;
export const ImageIssueSchema = z.enum(IMAGE_ISSUES);
export type ImageIssue = z.infer<typeof ImageIssueSchema>;

/** Quanto o usuário aceita comprar. */
export const SHOPPING_MODES = ['none', 'one', 'few', 'any'] as const;
export const ShoppingModeSchema = z.enum(SHOPPING_MODES);
export type ShoppingMode = z.infer<typeof ShoppingModeSchema>;

// ---------------------------------------------------------------------------
// Análise de imagem
// ---------------------------------------------------------------------------
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Limite da imagem decodificada (o app redimensiona para ~1280px antes de enviar). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const AnalyzeImageRequestSchema = z.object({
  image_base64: z.string().min(100).max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4),
  mime_type: z.enum(ALLOWED_IMAGE_TYPES),
});
export type AnalyzeImageRequest = z.infer<typeof AnalyzeImageRequestSchema>;

/** Saída bruta do modelo de visão. */
export const VisionOutputSchema = z.object({
  image_quality: z.object({
    usable: z.boolean(),
    issue: ImageIssueSchema,
    message: z.string().max(300),
  }),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        category: CategorySchema,
        quantity_estimate: z.string().max(40).nullable(),
        confidence: z.number().min(0).max(1),
        location_hint: LocationSchema.nullable(),
      }),
    )
    .max(60),
  notes: z.string().max(500).nullable(),
});
export type VisionOutput = z.infer<typeof VisionOutputSchema>;

export const DetectedIngredientSchema = z.object({
  name: z.string(),
  category: CategorySchema,
  quantity_estimate: z.string().nullable(),
  confidence: z.number(),
  needs_confirmation: z.boolean(),
  location_hint: LocationSchema.nullable(),
});
export type DetectedIngredient = z.infer<typeof DetectedIngredientSchema>;

export const AnalyzeImageResponseSchema = z.object({
  scan_id: z.string().uuid().nullable(),
  image: z.object({ usable: z.boolean(), issue: ImageIssueSchema, message: z.string() }),
  ingredients: z.array(DetectedIngredientSchema),
  notes: z.string().nullable(),
  quota: z.object({ used: z.number(), limit: z.number() }),
});
export type AnalyzeImageResponse = z.infer<typeof AnalyzeImageResponseSchema>;

// ---------------------------------------------------------------------------
// Geração de receitas
// ---------------------------------------------------------------------------
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const InventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  quantity: z.string().trim().max(40).nullable().optional(),
  expires_on: isoDate.nullable().optional(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const GenerateRecipesRequestSchema = z.object({
  ingredients: z.array(InventoryItemSchema).min(1).max(60),
  meal_type: MealTypeSchema.nullable().optional(),
  tags: z.array(RecipeTagSchema).max(10).default([]),
  max_minutes: z.number().int().min(5).max(600).nullable().optional(),
  servings: z.number().int().min(1).max(20).nullable().optional(),
  shopping: ShoppingModeSchema.default('few'),
  prioritize_expiring: z.boolean().default(false),
  scan_id: z.string().uuid().nullable().optional(),
});
export type GenerateRecipesRequest = z.input<typeof GenerateRecipesRequestSchema>;
export type GenerateRecipesParams = z.output<typeof GenerateRecipesRequestSchema>;

export const RecipeIngredientSchema = z.object({
  name: z.string().min(1).max(60),
  quantity: z.number().min(0).max(10000).nullable(),
  unit: z.string().max(20).nullable(),
  display_quantity: z.string().min(1).max(40),
  matched_inventory_item: z.string().max(60).nullable(),
  optional: z.boolean(),
  is_basic_staple: z.boolean(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const AIRecipeSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().min(5).max(300),
  meal_type: MealTypeSchema,
  tags: z.array(RecipeTagSchema).max(10),
  difficulty: DifficultySchema,
  prep_minutes: z.number().int().min(0).max(600),
  cook_minutes: z.number().int().min(0).max(600),
  servings: z.number().int().min(1).max(20),
  ingredients: z.array(RecipeIngredientSchema).min(1).max(30),
  steps: z
    .array(z.object({ text: z.string().min(5).max(500), minutes: z.number().int().min(0).max(600).nullable() }))
    .min(2)
    .max(25),
  nutrition_per_serving: z
    .object({
      calories: z.number().min(0).max(5000),
      protein_g: z.number().min(0).max(500),
      carbs_g: z.number().min(0).max(1000),
      fat_g: z.number().min(0).max(500),
    })
    .nullable(),
  substitutions: z
    .array(z.object({ ingredient: z.string().max(60), substitute: z.string().max(80), note: z.string().max(200) }))
    .max(10),
  side_suggestions: z.array(z.string().max(80)).max(6),
  allergen_notes: z.string().max(300).nullable(),
});
export type AIRecipe = z.infer<typeof AIRecipeSchema>;

export const AIRecipesOutputSchema = z.object({
  recipes: z.array(z.unknown()).max(12),
  notes: z.string().max(500).nullable(),
});

export const MissingItemSchema = z.object({
  name: z.string(),
  display_quantity: z.string(),
  optional: z.boolean(),
});
export type MissingItem = z.infer<typeof MissingItemSchema>;

export const RankedRecipeSchema = AIRecipeSchema.extend({
  have: z.array(z.string()),
  missing: z.array(MissingItemSchema),
  uses_expiring: z.array(z.string()),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export type RankedRecipe = z.infer<typeof RankedRecipeSchema>;

export const StoredRecipeSchema = RankedRecipeSchema.extend({ id: z.string().uuid() });
export type StoredRecipe = z.infer<typeof StoredRecipeSchema>;

export const GenerateRecipesResponseSchema = z.object({
  recipes: z.array(StoredRecipeSchema),
  removed_for_safety: z.number().int(),
  removed_invalid: z.number().int(),
  notes: z.string().nullable(),
  quota: z.object({ used: z.number(), limit: z.number() }),
});
export type GenerateRecipesResponse = z.infer<typeof GenerateRecipesResponseSchema>;

// ---------------------------------------------------------------------------
// Erros da API
// ---------------------------------------------------------------------------
export const API_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'consent_required',
  'payload_too_large',
  'unsupported_media_type',
  'quota_exceeded',
  'ai_not_configured',
  'ai_unavailable',
  'ai_rate_limited',
  'ai_invalid_response',
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const ApiErrorBodySchema = z.object({
  error: z.object({ code: z.enum(API_ERROR_CODES), message: z.string() }),
});

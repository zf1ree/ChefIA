// POST /functions/v1/generate-recipes
// Gera receitas a partir dos ingredientes confirmados pelo usuário, respeitando
// preferências e alergias salvas no perfil (lidas no servidor).
import { getProvider } from '../_shared/ai/provider.ts';
import { recipesSystemPrompt, recipesUserPrompt, type RecipePromptProfile } from '../_shared/ai/prompts.ts';
import { recipesSchema } from '../_shared/ai/jsonSchemas.ts';
import { todayIso } from '../_shared/domain/expiry.ts';
import { InvalidAIOutputError, processRecipesOutput, type ProcessedRecipes } from '../_shared/domain/pipeline.ts';
import { totalMinutes } from '../_shared/domain/ranking.ts';
import {
  GenerateRecipesRequestSchema,
  type GenerateRecipesResponse,
  type StoredRecipe,
} from '../_shared/domain/schemas.ts';
import { ApiError, handle, json, readJsonBody } from '../_shared/http.ts';
import { consumeQuota, getContext, refundQuota } from '../_shared/supabase.ts';

interface ProfileRow {
  allergies: string[];
  dietary_restrictions: string[];
  disliked_ingredients: string[];
  cuisine_preferences: string[];
  pantry_staples: string[];
  max_cooking_minutes: number | null;
  default_servings: number;
}

Deno.serve(
  handle(async (req) => {
    const parsed = GenerateRecipesRequestSchema.safeParse(await readJsonBody(req, 64 * 1024));
    if (!parsed.success) {
      throw new ApiError('bad_request', 400, 'Dados inválidos. Confira a lista de ingredientes.');
    }
    const params = parsed.data;
    const ctx = await getContext(req);

    const { data: profileData, error: profileErr } = await ctx.userClient
      .from('profiles')
      .select('allergies, dietary_restrictions, disliked_ingredients, cuisine_preferences, pantry_staples, max_cooking_minutes, default_servings')
      .eq('id', ctx.userId)
      .single();
    if (profileErr || !profileData) throw new ApiError('internal', 500, 'Não foi possível carregar seu perfil.');
    const profile = profileData as ProfileRow;

    // Personalização a partir das avaliações recentes.
    const { data: feedback } = await ctx.userClient
      .from('recipe_feedback')
      .select('rating, recipes(title)')
      .order('updated_at', { ascending: false })
      .limit(20);
    const fb = (feedback ?? []) as unknown as { rating: number; recipes: { title: string } | null }[];
    const promptProfile: RecipePromptProfile = {
      allergies: profile.allergies,
      dietary_restrictions: profile.dietary_restrictions,
      disliked_ingredients: profile.disliked_ingredients,
      cuisine_preferences: profile.cuisine_preferences,
      pantry_staples: profile.pantry_staples,
      liked_titles: fb.filter((f) => f.rating >= 4 && f.recipes).map((f) => f.recipes!.title).slice(0, 8),
      disliked_titles: fb.filter((f) => f.rating <= 2 && f.recipes).map((f) => f.recipes!.title).slice(0, 8),
    };

    const servings = params.servings ?? profile.default_servings;
    const maxMinutes = params.max_minutes ?? profile.max_cooking_minutes ?? null;
    const today = todayIso();
    const safetyKeys = [...profile.allergies, ...profile.dietary_restrictions, ...profile.disliked_ingredients];

    const provider = getProvider();
    const quota = await consumeQuota(ctx, 'recipes');

    const messages = [
      { role: 'system' as const, content: recipesSystemPrompt() },
      { role: 'user' as const, content: recipesUserPrompt(params, promptProfile, today, servings, maxMinutes) },
    ];
    const run = async (extra?: string) =>
      processRecipesOutput(
        await provider.completeJson({
          task: 'text',
          schemaName: 'recipes',
          schema: recipesSchema,
          maxTokens: 9000,
          temperature: 0.5,
          messages: extra ? [...messages, { role: 'user', content: extra }] : messages,
        }),
        { inventory: params.ingredients, confirmedStaples: profile.pantry_staples, today },
        { shopping: params.shopping, prioritizeExpiring: params.prioritize_expiring, maxMinutes },
        safetyKeys,
      );

    let result: ProcessedRecipes;
    try {
      try {
        result = await run();
      } catch (err) {
        if (!(err instanceof InvalidAIOutputError)) throw err;
        result = { recipes: [], removedForSafety: 0, removedInvalid: 0, notes: null };
      }
      // Nova tentativa controlada quando nada sobreviveu à validação.
      if (result.recipes.length === 0) {
        console.warn('nenhuma receita válida; nova tentativa', {
          removedForSafety: result.removedForSafety,
          removedInvalid: result.removedInvalid,
        });
        const retry = await run(
          'Algumas receitas anteriores foram rejeitadas por violar restrições, exigir ingredientes demais ou ter tempos incoerentes. ' +
            'Gere novas receitas mais simples, usando principalmente o inventário, respeitando estritamente as regras.',
        );
        result = {
          ...retry,
          removedForSafety: retry.removedForSafety + result.removedForSafety,
          removedInvalid: retry.removedInvalid + result.removedInvalid,
        };
      }
    } catch (err) {
      await refundQuota(ctx, quota.eventId);
      if (err instanceof InvalidAIOutputError) {
        throw new ApiError('ai_invalid_response', 502, 'A IA não conseguiu gerar receitas válidas. Tente novamente.');
      }
      throw err;
    }

    let stored: StoredRecipe[] = [];
    if (result.recipes.length) {
      const { data: rows, error } = await ctx.adminClient
        .from('recipes')
        .insert(
          result.recipes.map((r) => ({
            user_id: ctx.userId,
            scan_id: params.scan_id ?? null,
            title: r.title,
            meal_type: r.meal_type,
            difficulty: r.difficulty,
            total_minutes: totalMinutes(r),
            servings: r.servings,
            data: r,
            model: `${provider.name}:${provider.modelFor('text')}`,
          })),
        )
        .select('id');
      if (error || !rows) {
        console.error('insert recipes', error);
        throw new ApiError('internal', 500, 'As receitas foram geradas, mas não puderam ser salvas. Tente novamente.');
      }
      // insert...select preserva a ordem das linhas enviadas.
      stored = result.recipes.map((r, i) => ({ ...r, id: (rows[i] as { id: string }).id }));
    }

    const response: GenerateRecipesResponse = {
      recipes: stored,
      removed_for_safety: result.removedForSafety,
      removed_invalid: result.removedInvalid,
      notes: result.notes,
      quota: { used: quota.used, limit: quota.limit },
    };
    return json(response);
  }),
);

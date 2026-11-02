import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { ApiError } from './http.ts';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export interface RequestContext {
  userId: string;
  /** Cliente com o JWT do usuário: respeita RLS. */
  userClient: SupabaseClient;
  /** Cliente service role: só para escritas que o usuário não pode fazer diretamente. */
  adminClient: SupabaseClient;
}

export async function getContext(req: Request): Promise<RequestContext> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('unauthorized', 401, 'Faça login para continuar.');
  }
  const url = env('SUPABASE_URL');
  const userClient = createClient(url, env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError('unauthorized', 401, 'Sessão expirada. Faça login novamente.');
  }
  const adminClient = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { userId: data.user.id, userClient, adminClient };
}

/** Consome 1 unidade da cota diária. Lança 429 se esgotada. */
export async function consumeQuota(
  ctx: RequestContext,
  kind: 'scan' | 'recipes',
): Promise<{ eventId: number; used: number; limit: number }> {
  const { data, error } = await ctx.userClient.rpc('consume_ai_quota', { p_kind: kind });
  if (error) {
    if (error.message?.includes('quota_exceeded')) {
      throw new ApiError(
        'quota_exceeded',
        429,
        kind === 'scan'
          ? 'Você atingiu o limite diário de análises de fotos do seu plano. Tente novamente amanhã.'
          : 'Você atingiu o limite diário de geração de receitas do seu plano. Tente novamente amanhã.',
      );
    }
    console.error('consume_ai_quota', error);
    throw new ApiError('internal', 500, 'Não foi possível verificar seu limite de uso.');
  }
  const row = (data as { event_id: number; used: number; quota: number }[])[0];
  return { eventId: row.event_id, used: row.used, limit: row.quota };
}

export async function refundQuota(ctx: RequestContext, eventId: number): Promise<void> {
  const { error } = await ctx.adminClient.rpc('refund_ai_quota', { p_event_id: eventId });
  if (error) console.error('refund_ai_quota', error);
}

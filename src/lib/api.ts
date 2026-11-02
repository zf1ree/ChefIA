// Chamadas às Edge Functions com tratamento de erros consistente.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import {
  AnalyzeImageResponseSchema,
  ApiErrorBodySchema,
  GenerateRecipesResponseSchema,
  type AnalyzeImageResponse,
  type ApiErrorCode,
  type GenerateRecipesRequest,
  type GenerateRecipesResponse,
} from '@shared/schemas';

import { supabase } from './supabase';

export type ClientErrorCode = ApiErrorCode | 'network' | 'invalid_response';

export class AppError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
  ) {
    super(message);
  }

  /** Vale a pena oferecer "Tentar novamente"? */
  get retryable(): boolean {
    return ['network', 'ai_unavailable', 'ai_rate_limited', 'ai_invalid_response', 'internal', 'invalid_response'].includes(
      this.code,
    );
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>, parse: (data: unknown) => T): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await (error.context as Response).json().catch(() => null);
      const parsed = ApiErrorBodySchema.safeParse(payload);
      if (parsed.success) throw new AppError(parsed.data.error.code, parsed.data.error.message);
      const status = (error.context as Response).status;
      if (status === 401) throw new AppError('unauthorized', 'Sua sessão expirou. Entre novamente.');
      throw new AppError('internal', 'Algo deu errado no servidor. Tente novamente.');
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new AppError('network', 'Sem conexão com o servidor. Verifique sua internet e tente novamente.');
    }
    throw new AppError('internal', 'Algo deu errado. Tente novamente.');
  }
  try {
    return parse(data);
  } catch {
    throw new AppError('invalid_response', 'Recebemos uma resposta inesperada. Tente novamente.');
  }
}

export function analyzeImage(imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<AnalyzeImageResponse> {
  return invoke('analyze-image', { image_base64: imageBase64, mime_type: mimeType }, (d) => AnalyzeImageResponseSchema.parse(d));
}

export function generateRecipes(req: GenerateRecipesRequest): Promise<GenerateRecipesResponse> {
  return invoke('generate-recipes', { ...req }, (d) => GenerateRecipesResponseSchema.parse(d));
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    const msg = (err as { message: string }).message;
    if (/network|fetch/i.test(msg)) return new AppError('network', 'Sem conexão. Verifique sua internet e tente novamente.');
  }
  return new AppError('internal', 'Algo deu errado. Tente novamente.');
}

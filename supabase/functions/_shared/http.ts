import type { ApiErrorCode } from './domain/schemas.ts';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error('unhandled error', err);
  return json({ error: { code: 'internal', message: 'Erro interno. Tente novamente em instantes.' } }, 500);
}

/** Lê o corpo como JSON respeitando um limite de tamanho. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) {
    throw new ApiError('payload_too_large', 413, 'A imagem é grande demais. Tente uma foto menor.');
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new ApiError('payload_too_large', 413, 'A imagem é grande demais. Tente uma foto menor.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('bad_request', 400, 'Corpo da requisição inválido.');
  }
}

export function handle(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: { code: 'bad_request', message: 'Use POST.' } }, 405);
    try {
      return await fn(req);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

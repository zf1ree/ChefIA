// POST /functions/v1/analyze-image
// Recebe uma foto (base64), identifica os alimentos com um modelo multimodal
// e devolve a lista para o usuário revisar. A imagem NÃO é armazenada.
import { getProvider } from '../_shared/ai/provider.ts';
import { VISION_SYSTEM, VISION_USER } from '../_shared/ai/prompts.ts';
import { visionSchema } from '../_shared/ai/jsonSchemas.ts';
import { InvalidAIOutputError, processVisionOutput, type ProcessedVision } from '../_shared/domain/pipeline.ts';
import {
  AnalyzeImageRequestSchema,
  MAX_IMAGE_BYTES,
  type AnalyzeImageResponse,
} from '../_shared/domain/schemas.ts';
import { ApiError, handle, json, readJsonBody } from '../_shared/http.ts';
import { consumeQuota, getContext, refundQuota } from '../_shared/supabase.ts';

const MAX_BODY_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 2048;

/** Confere os "magic bytes" para não confiar só no mime_type declarado. */
function sniffImageType(base64: string): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  let head: Uint8Array;
  try {
    const bin = atob(base64.slice(0, 24));
    head = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

Deno.serve(
  handle(async (req) => {
    const body = AnalyzeImageRequestSchema.safeParse(await readJsonBody(req, MAX_BODY_BYTES));
    if (!body.success) {
      throw new ApiError('bad_request', 400, 'Envie uma imagem JPEG, PNG ou WebP de até 4 MB.');
    }
    const { image_base64, mime_type } = body.data;

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image_base64)) {
      throw new ApiError('bad_request', 400, 'Imagem em formato inválido.');
    }
    const decodedBytes = Math.floor((image_base64.length * 3) / 4);
    if (decodedBytes > MAX_IMAGE_BYTES) {
      throw new ApiError('payload_too_large', 413, 'A imagem é grande demais. Tente uma foto menor.');
    }
    const sniffed = sniffImageType(image_base64);
    if (!sniffed || sniffed !== mime_type) {
      throw new ApiError('unsupported_media_type', 415, 'O arquivo enviado não é uma imagem válida.');
    }

    const ctx = await getContext(req);

    const { data: profile } = await ctx.userClient
      .from('profiles')
      .select('image_processing_consent_at')
      .eq('id', ctx.userId)
      .single();
    if (!profile?.image_processing_consent_at) {
      throw new ApiError('consent_required', 403, 'É preciso autorizar o processamento de imagens antes de enviar fotos.');
    }

    const provider = getProvider();
    const quota = await consumeQuota(ctx, 'scan');

    let result: ProcessedVision;
    try {
      const request = {
        task: 'vision' as const,
        schemaName: 'fridge_scan',
        schema: visionSchema,
        maxTokens: 2000,
        temperature: 0.1,
        messages: [
          { role: 'system' as const, content: VISION_SYSTEM },
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: VISION_USER },
              { type: 'image_url' as const, image_url: { url: `data:${mime_type};base64,${image_base64}` } },
            ],
          },
        ],
      };
      try {
        result = processVisionOutput(await provider.completeJson(request));
      } catch (err) {
        // Uma nova tentativa controlada se a saída vier fora do contrato.
        if (!(err instanceof InvalidAIOutputError) && !(err instanceof ApiError && err.code === 'ai_invalid_response')) {
          throw err;
        }
        console.warn('vision output inválido, tentando novamente', String(err).slice(0, 300));
        result = processVisionOutput(await provider.completeJson(request));
      }
    } catch (err) {
      await refundQuota(ctx, quota.eventId);
      if (err instanceof InvalidAIOutputError) {
        throw new ApiError('ai_invalid_response', 502, 'A IA não conseguiu analisar esta foto. Tente novamente.');
      }
      throw err;
    }

    // Histórico da análise (somente metadados e ingredientes, nunca a foto).
    let scanId: string | null = null;
    const { data: scan, error: scanErr } = await ctx.adminClient
      .from('scans')
      .insert({
        user_id: ctx.userId,
        image_usable: result.image.usable,
        image_issue: result.image.issue,
        model: `${provider.name}:${provider.modelFor('vision')}`,
        notes: result.notes,
      })
      .select('id')
      .single();
    if (scanErr) {
      console.error('insert scan', scanErr);
    } else {
      scanId = scan.id as string;
      if (result.ingredients.length) {
        const { error } = await ctx.adminClient.from('scan_ingredients').insert(
          result.ingredients.map((i) => ({
            scan_id: scanId,
            user_id: ctx.userId,
            name: i.name,
            category: i.category,
            quantity_estimate: i.quantity_estimate,
            confidence: i.confidence,
            needs_confirmation: i.needs_confirmation,
          })),
        );
        if (error) console.error('insert scan_ingredients', error);
      }
    }

    const response: AnalyzeImageResponse = {
      scan_id: scanId,
      image: result.image,
      ingredients: result.ingredients,
      notes: result.notes,
      quota: { used: quota.used, limit: quota.limit },
    };
    return json(response);
  }),
);

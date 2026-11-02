// Camada de provedor de IA. Hoje: qualquer API compatível com OpenAI Chat
// Completions (Groq por padrão; OpenAI funciona trocando variáveis de ambiente).
// Para outro provedor (Anthropic, Gemini...), implemente `AIProvider`.
import { ApiError } from '../http.ts';

export type ChatContent =
  | string
  | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
}

export interface JsonCompletionRequest {
  task: 'vision' | 'text';
  messages: ChatMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  temperature?: number;
}

export interface AIProvider {
  readonly name: string;
  modelFor(task: JsonCompletionRequest['task']): string;
  /** Retorna o JSON (ainda não validado) produzido pelo modelo. */
  completeJson(req: JsonCompletionRequest): Promise<unknown>;
}

interface ProviderPreset {
  baseUrl: string;
  keyEnv: string;
  visionModel: string;
  textModel: string;
}

const PRESETS: Record<string, ProviderPreset> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    visionModel: 'qwen/qwen3.8-27b',
    textModel: 'openai/gpt-oss-120b',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
    visionModel: 'gpt-4.1-mini',
    textModel: 'gpt-4.1-mini',
  },
};

const REQUEST_TIMEOUT_MS = 60_000;

class OpenAICompatibleProvider implements AIProvider {
  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly visionModel: string,
    private readonly textModel: string,
  ) {}

  modelFor(task: JsonCompletionRequest['task']): string {
    return task === 'vision' ? this.visionModel : this.textModel;
  }

  async completeJson(req: JsonCompletionRequest): Promise<unknown> {
    const body = {
      model: this.modelFor(req.task),
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      max_completion_tokens: req.maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: { name: req.schemaName, strict: true, schema: req.schema },
      },
    };

    // Uma nova tentativa para 429/5xx/timeout, com espera curta.
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        console.error(`[${this.name}] network/timeout`, err);
        if (attempt === 0) continue;
        throw new ApiError('ai_unavailable', 503, 'O serviço de IA não respondeu. Tente novamente.');
      }
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new ApiError('ai_invalid_response', 502, 'A IA retornou uma resposta vazia.');
        try {
          return JSON.parse(content);
        } catch {
          throw new ApiError('ai_invalid_response', 502, 'A IA retornou um formato inválido.');
        }
      }

      const detail = await res.text().catch(() => '');
      console.error(`[${this.name}] HTTP ${res.status}`, detail.slice(0, 500));
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await new Promise((r) => setTimeout(r, res.status === 429 ? 2000 : 800));
        continue;
      }
      if (res.status === 429) {
        throw new ApiError('ai_rate_limited', 503, 'Muitas pessoas usando a IA agora. Tente em alguns segundos.');
      }
      if (res.status === 401 || res.status === 403) {
        throw new ApiError('ai_not_configured', 503, 'A chave da API de IA é inválida ou não tem permissão.');
      }
      if (res.status === 400 && /json|schema|validat/i.test(detail)) {
        throw new ApiError('ai_invalid_response', 502, 'A IA não conseguiu gerar uma resposta válida.');
      }
      throw new ApiError('ai_unavailable', 503, 'O serviço de IA está indisponível no momento.');
    }
    throw new ApiError('ai_unavailable', 503, 'O serviço de IA está indisponível no momento.');
  }
}

export function getProvider(): AIProvider {
  const name = (Deno.env.get('AI_PROVIDER') ?? 'groq').toLowerCase();
  const preset = PRESETS[name];
  if (!preset) throw new ApiError('ai_not_configured', 503, `Provedor de IA desconhecido: ${name}`);
  const key = Deno.env.get(preset.keyEnv);
  if (!key) {
    throw new ApiError('ai_not_configured', 503, `IA não configurada: defina o segredo ${preset.keyEnv} no Supabase.`);
  }
  return new OpenAICompatibleProvider(
    name,
    Deno.env.get('AI_BASE_URL') ?? preset.baseUrl,
    key,
    Deno.env.get('AI_VISION_MODEL') ?? preset.visionModel,
    Deno.env.get('AI_TEXT_MODEL') ?? preset.textModel,
  );
}

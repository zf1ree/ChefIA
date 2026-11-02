# Arquitetura

## Visão geral

```
App (Expo / React Native)
  │  supabase-js (chave publicável + JWT do usuário)
  ├──────────────► Postgres (RLS)  — geladeira, receitas, favoritos, listas, histórico
  │
  └─► Edge Functions (Deno, JWT obrigatório)
        analyze-image ──► Provedor de IA (visão)   ──┐
        generate-recipes ─► Provedor de IA (texto) ──┤ Groq (padrão) / OpenAI / outro compatível
                                                     │
        _shared/domain: Zod + ranking + alergias ◄───┘ validação e pós-processamento
```

Decisões principais:

- **Sem servidor próprio no MVP.** Edge Functions do Supabase guardam a chave da IA, aplicam cotas e validam respostas. Menos infraestrutura para manter.
- **Regras de negócio puras e compartilhadas** em `supabase/functions/_shared/domain/`. O app importa os mesmos arquivos via alias `@shared/*`, então app e servidor usam o mesmo contrato Zod.
- **A IA não decide o que o usuário tem.** O modelo indica qual item do inventário usou, mas o servidor recalcula "tenho / falta comprar" com normalização de nomes. Itens básicos (sal, óleo…) só contam se o usuário confirmou.
- **Provedor de IA plugável.** `AIProvider` (em `_shared/ai/provider.ts`) com implementação para qualquer API compatível com OpenAI Chat Completions + Structured Outputs. Trocar de Groq para OpenAI é só mudar `AI_PROVIDER`; outro fornecedor exige uma nova classe.

## Fluxo da foto

1. **Captura** (`scan/capture`): consentimento LGPD na primeira vez → câmera ou galeria → prévia → confirmação.
2. **Análise** (`scan/analyzing`), cada etapa exibida é real:
   1. *Otimizando a foto no aparelho*: redimensiona para 1280 px, JPEG 72%.
   2. *Identificando ingredientes com IA*: `POST analyze-image`.
   3. *Preparando a lista*: monta os itens de revisão.
3. **Servidor** (`analyze-image`): valida tamanho/tipo (magic bytes) → autentica → exige consentimento → consome cota → modelo de visão com JSON Schema estrito → valida com Zod (1 nova tentativa) → descarta itens com confiança < 0,35, marca < 0,70 como "incerto" → salva o histórico (sem a foto).
4. **Revisão** (`scan/review`): editar, remover, adicionar (texto livre ou catálogo). Itens incertos precisam ser confirmados ou removidos. Opção de salvar em Minha Geladeira.
5. **Geração** (`recipes/generate` → `generate-recipes`): refeição, tempo, porções, disposição para comprar, estilos, prioridade de vencimento, básicos confirmados. O servidor lê alergias/restrições **do perfil** (não confia no cliente), consome cota, gera, valida cada receita (schema + coerência de tempos + duplicatas), filtra por segurança, classifica e salva.
6. **Resultados** (`recipes/results`), agrupados por tier:
   1. Dá pra fazer agora (só inventário + básicos confirmados)
   2. Falta 1 ingrediente
   3. Faltam poucos (2–3)
   4. Aproveita itens perto do vencimento (mesmo faltando mais)

## Contratos das APIs

Todas exigem `Authorization: Bearer <JWT do usuário>`. Os erros seguem o formato `{ "error": { "code", "message" } }`.

### `POST /functions/v1/analyze-image`

```jsonc
// requisição
{ "image_base64": "<jpeg/png/webp em base64, ≤ 4 MB>", "mime_type": "image/jpeg" }
// resposta 200
{
  "scan_id": "uuid | null",
  "image": { "usable": true, "issue": "none|too_dark|blurry|no_food|too_far|obstructed|other", "message": "..." },
  "ingredients": [
    { "name": "Ovo", "category": "ovos", "quantity_estimate": "6 unidades", "confidence": 0.95,
      "needs_confirmation": false, "location_hint": "fridge" }
  ],
  "notes": "Há potes fechados cujo conteúdo não é visível | null",
  "quota": { "used": 1, "limit": 5 }
}
```

### `POST /functions/v1/generate-recipes`

```jsonc
// requisição
{
  "ingredients": [{ "name": "Ovo", "quantity": "6 unidades", "expires_on": "2026-10-12" }],
  "meal_type": "jantar | null",
  "tags": ["rapida", "economica"],
  "max_minutes": 30,
  "servings": 2,
  "shopping": "none | one | few | any",
  "prioritize_expiring": false,
  "scan_id": "uuid | null"
}
// resposta 200
{
  "recipes": [ { "id": "uuid", "title": "...", "tier": 1, "have": ["Ovos"], "missing": [...],
                 "uses_expiring": [], "ingredients": [...], "steps": [...], "nutrition_per_serving": {...},
                 "substitutions": [...], "side_suggestions": [...], "allergen_notes": "...", ... } ],
  "removed_for_safety": 0,
  "removed_invalid": 1,
  "notes": null,
  "quota": { "used": 3, "limit": 15 }
}
```

Os schemas completos estão em `supabase/functions/_shared/domain/schemas.ts`.

| Código | HTTP | Significado |
|---|---|---|
| `bad_request` | 400 | Corpo inválido |
| `unauthorized` | 401 | Sem sessão / sessão expirada |
| `consent_required` | 403 | Usuário não autorizou processamento de imagens |
| `payload_too_large` | 413 | Imagem > 4 MB |
| `unsupported_media_type` | 415 | Arquivo não é JPEG/PNG/WebP |
| `quota_exceeded` | 429 | Limite diário do plano |
| `ai_not_configured` | 503 | Falta `GROQ_API_KEY` ou chave inválida |
| `ai_rate_limited` / `ai_unavailable` | 503 | Provedor sobrecarregado/fora (já tenta 1x de novo) |
| `ai_invalid_response` | 502 | Saída inválida mesmo após nova tentativa |

## Banco de dados

| Tabela | Conteúdo | Acesso do usuário |
|---|---|---|
| `profiles` | Preferências, alergias, básicos, plano, consentimento | ler/editar o próprio (exceto `plan`) |
| `ingredients` | Catálogo público (58 itens iniciais) | leitura |
| `user_ingredients` | Minha Geladeira (local, validade, observações) | CRUD próprio |
| `scans` / `scan_ingredients` | Histórico das análises (sem foto) | ler/excluir próprio; escrita só pela função |
| `recipes` | Receitas geradas (documento validado em `jsonb`) | ler/excluir próprio; escrita só pela função |
| `favorites` | Favoritos | próprio, só de receitas próprias |
| `shopping_lists` / `shopping_list_items` | Lista de compras (dedupe por nome normalizado) | CRUD próprio |
| `cooking_history` | Receitas preparadas | próprio |
| `recipe_feedback` | Nota, "funcionou?", comentário (usado para personalizar) | CRUD próprio |
| `plan_limits` / `ai_usage_events` | Cotas por plano e consumo | leitura; escrita só via funções |

Decisão de modelagem: **não há `recipe_ingredients`**. Receitas geradas são documentos imutáveis lidos inteiros; guardar em `jsonb` evita joins e mantém exatamente o que foi validado. Se houver catálogo editorial de receitas no futuro, uma tabela normalizada passa a fazer sentido.

Funções SQL: `consume_ai_quota` (security definer, com lock por usuário), `refund_ai_quota` (só service role), `get_ai_usage`, `delete_my_account` (LGPD).

## Personalização

As últimas 20 avaliações são lidas no servidor: receitas com nota ≥ 4 viram referência de estilo e com nota ≤ 2 viram "evite parecidas" no prompt.

## Evolução prevista

- **Planejamento semanal / cardápios:** nova função `plan-week` reaproveitando o mesmo pipeline e salvando um plano que referencia `recipes`.
- **Custo por porção / orçamento:** tabela de preços por ingrediente/região + campo de custo estimado na receita.
- **Mercados/entrega:** a lista de compras já é normalizada por nome e categoria, pronta para mapear SKUs.
- **Assistente durante o preparo:** função de chat com o `recipe.data` como contexto.
- **Premium:** `plan_limits` já diferencia os planos; falta integrar o pagamento (RevenueCat / lojas) e atualizar `profiles.plan` via webhook com service role.

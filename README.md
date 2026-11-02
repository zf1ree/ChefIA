# ChefIA — Seu Chef Inteligente

Aplicativo (Android, iOS e web) que identifica ingredientes por foto com IA e sugere receitas priorizando o que você já tem em casa.

**Fluxo principal:** fotografar → IA identifica ingredientes → usuário revisa → IA gera receitas personalizadas → ver preparo → salvar receitas e gerenciar a geladeira.

> O nome "ChefIA" é provisório e pode ser trocado em `EXPO_PUBLIC_APP_NAME` (.env) e em `app.json` (`name`, `slug`, `scheme`, ids das lojas).

---

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| App | React Native + **Expo SDK 57** + TypeScript + **Expo Router** | Um código para Android/iOS/web, builds na nuvem (EAS) |
| Backend | **Supabase** (Postgres, Auth, Edge Functions em Deno) | Auth + banco + RLS + funções serverless sem servidor próprio |
| IA | **Groq** (API compatível com OpenAI) via camada de provedor | Baixa latência e custo; troca de provedor por variável de ambiente |
| Validação | **Zod** (schemas compartilhados entre app e backend) | Um único contrato de dados, validado nos dois lados |
| Testes | Jest (jest-expo) + teste SQL de RLS | Regras de negócio e autorização |

Mais detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md), custos em [docs/CUSTOS-E-MONETIZACAO.md](docs/CUSTOS-E-MONETIZACAO.md) e publicação em [docs/PUBLICACAO.md](docs/PUBLICACAO.md).

## Estrutura

```
src/
  app/                  Telas (Expo Router)
    (auth)/             Login e cadastro
    (tabs)/             Início, Geladeira, Receitas, Compras, Perfil
    scan/               Captura → análise → revisão
    recipes/            Opções de geração, resultados, detalhe
    fridge/[id].tsx     Criar/editar ingrediente
    what-now.tsx        "O que posso fazer agora?"
    preferences.tsx     Preferências alimentares
    settings.tsx        Configurações (consentimento, exclusão de dados/conta)
    privacy.tsx         Política de privacidade (LGPD)
  components/           UI reutilizável (ui/) e componentes de domínio
  lib/                  Supabase client, chamadas às Edge Functions, imagem, rótulos
  services/             Acesso a dados (perfil, geladeira, receitas, compras, análises)
  providers/            Sessão/perfil, onboarding
  state/                Estado em memória do fluxo foto → receitas
supabase/
  migrations/           Migrations versionadas (schema, RLS, cotas, seed)
  functions/
    analyze-image/      Edge Function: foto → ingredientes
    generate-recipes/   Edge Function: ingredientes → receitas
    _shared/domain/     Regras puras (Zod, normalização, ranking, alergias, validade)
    _shared/ai/         Provedor de IA, prompts e JSON Schemas
  tests/rls_test.sql    Teste de RLS/autorização
tests/domain/           Testes unitários (Jest)
scripts/generate-icons.js
```

## Como rodar

Pré-requisitos: Node.js 20+ (testado com 24), conta Supabase, chave da Groq.

```bash
npm install
```

```bash
npx expo start
```

Abra no celular com o **Expo Go** (QR code), ou pressione `w` para web. A câmera funciona no celular; na web, use "Escolher da galeria".

> Observação: a câmera e o seletor de imagens fazem parte do Expo Go. Para gerar um app instalável use EAS (ver docs/PUBLICACAO.md).

### Variáveis de ambiente do app (`.env.local`)

Copie `.env.example` para `.env.local`:

| Variável | Onde obter |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys (chave **publicável** `sb_publishable_…`) |
| `EXPO_PUBLIC_APP_NAME` | Opcional, nome exibido |

⚠️ Tudo com prefixo `EXPO_PUBLIC_` vai dentro do app. **Nunca** coloque a service role key nem a chave da IA aqui.

### Segredos do backend (Supabase → Edge Functions → Secrets)

| Segredo | Obrigatório | Descrição |
|---|---|---|
| `GROQ_API_KEY` | **sim** | Crie em https://console.groq.com/keys |
| `AI_PROVIDER` | não | `groq` (padrão) ou `openai` (exige `OPENAI_API_KEY`) |
| `AI_VISION_MODEL` | não | Padrão `qwen/qwen3.8-27b` |
| `AI_TEXT_MODEL` | não | Padrão `openai/gpt-oss-120b` |
| `AI_BASE_URL` | não | Outro endpoint compatível com OpenAI |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente nas Edge Functions.

Pelo Supabase CLI:

```bash
npx supabase secrets set GROQ_API_KEY=sua_chave --project-ref pvyxdfeegicriclohszd
```

Sem esse segredo, o app funciona (login, geladeira, listas), mas a análise de fotos e a geração de receitas retornam a mensagem "IA não configurada".

## Configurar um projeto Supabase do zero

1. Crie o projeto (de preferência na região `sa-east-1`, São Paulo).
2. Vincule e aplique as migrations:
   ```bash
   npx supabase link --project-ref SEU_REF
   ```
   ```bash
   npx supabase db push
   ```
3. Publique as funções:
   ```bash
   npx supabase functions deploy analyze-image
   ```
   ```bash
   npx supabase functions deploy generate-recipes
   ```
4. Defina o segredo `GROQ_API_KEY` (acima).
5. Auth → Providers → Email: deixe habilitado. Com "Confirm email" ligado, o usuário precisa confirmar o e-mail antes de entrar (o app já mostra essa orientação). Configure o SMTP próprio antes do lançamento (o SMTP padrão do Supabase tem limite baixo de envios).
6. Rode o teste de RLS no SQL Editor: cole `supabase/tests/rls_test.sql`. O resultado esperado é o erro `RLS_TESTS_PASSED (20 verificações)` (o script sempre termina com exceção para desfazer tudo).

O projeto atual (`pvyxdfeegicriclohszd`, org "BT Club") **já está configurado**: migrations aplicadas, funções publicadas. Falta apenas o segredo `GROQ_API_KEY`.

## Testes e verificações

```bash
npm run check
```

Executa `tsc` no app, `tsc` nas Edge Functions (com tipos mínimos do Deno) e os testes Jest. Lint:

```bash
npm run lint
```

| O que | Como |
|---|---|
| Regras de negócio (normalização, ranking, alergias, validade, validação das respostas da IA) | `npm test` — 35 testes |
| Autorização / RLS / cotas | `supabase/tests/rls_test.sql` — 20 verificações |
| Contrato HTTP das funções | Testes manuais com curl (CORS, JWT obrigatório, corpo inválido, arquivo que não é imagem) |

## Segurança

- Chaves privadas apenas no backend (Secrets das Edge Functions). O app usa a chave publicável.
- RLS em todas as tabelas; o usuário só lê/escreve as próprias linhas. Escritas sensíveis (scans, receitas geradas, uso de IA) só pelas Edge Functions.
- O usuário **não consegue alterar o próprio plano** (permissão de UPDATE por coluna).
- Limites diários de uso de IA no **banco** (`plan_limits`, `consume_ai_quota`), com bloqueio transacional contra chamadas concorrentes. Falhas da IA devolvem a cota.
- Upload: limite de 4 MB, tipos JPEG/PNG/WebP verificados pelos *magic bytes*, redimensionamento para 1280 px no aparelho.
- Fotos **não são armazenadas**; apenas a lista de ingredientes.
- Alergias/restrições: enviadas à IA **e** reverificadas no servidor com lista de termos conservadora; receitas conflitantes são descartadas e substituições inseguras removidas. O app sempre avisa que a IA não garante ausência de contaminação cruzada.
- LGPD: consentimento explícito antes da primeira foto (revogável), política de privacidade, exclusão do histórico e exclusão da conta pelo próprio usuário.

## Limitações conhecidas

- A política de privacidade é um rascunho: precisa de revisão jurídica e dos dados do controlador/DPO.
- Sem foto real do prato: o app usa uma ilustração por tipo de refeição (geração de imagens aumentaria o custo).
- O modelo de visão padrão da Groq está em *preview* e pode mudar; ajuste `AI_VISION_MODEL` se necessário.
- Temporizadores de passo funcionam só com o app aberto (sem notificação em segundo plano).
- Plano Premium e cobrança ainda não implementados (os limites por plano já são aplicados pelo backend).
- Planejamento semanal, custo por porção, integração com mercados e assistente interativo estão no roadmap.

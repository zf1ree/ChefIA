# Custos de IA e monetização

> Preços consultados em outubro/2026 na documentação da Groq. **Nenhum serviço foi considerado gratuito**: a Groq tem um nível gratuito com limites de taxa baixos, útil só para desenvolvimento. Confira os valores atuais antes de definir preços.

## Comparação de provedores (resumo)

| Critério | Groq (escolhido) | OpenAI | Google Gemini | Anthropic Claude |
|---|---|---|---|---|
| Visão + JSON estrito | Sim (`qwen/qwen3.8-27b`, *preview*) | Sim | Sim | Sim |
| Latência | Muito baixa (hardware próprio) | Média | Baixa | Média |
| Custo texto | Muito baixo (`gpt-oss-120b` US$ 0,15 / 0,60 por 1M) | Médio | Baixo | Médio/alto |
| Integração | API compatível com OpenAI (trivial) | Nativa | SDK próprio | SDK próprio |
| Risco | Modelo de visão em *preview* | — | — | — |

A escolha atende ao pedido de usar Groq. A arquitetura isola o provedor (`AIProvider`): migrar para OpenAI é só configurar `AI_PROVIDER=openai` + `OPENAI_API_KEY`; Gemini/Claude exigem uma nova classe (~80 linhas).

## Custo estimado por operação (Groq)

| Operação | Modelo | Entrada | Saída | Custo aprox. |
|---|---|---|---|---|
| Análise de foto | qwen3.8-27b (US$ 0,80 / 4,00 por 1M) | ~2.600 tokens (imagem = 2.048) | ~600 | **≈ US$ 0,0045** |
| Geração de 4–6 receitas | gpt-oss-120b (US$ 0,15 / 0,60 por 1M) | ~1.500 | ~5.000–7.000 (inclui raciocínio) | **≈ US$ 0,004** |

Uma nova tentativa (saída inválida) pode dobrar o custo daquela chamada; falhas do provedor devolvem a cota ao usuário, mas o custo pode já ter ocorrido.

## Custo por usuário/mês

| Perfil | Uso mensal | Custo de IA |
|---|---|---|
| Ocasional | 8 fotos + 15 gerações | ≈ US$ 0,10 |
| Engajado | 30 fotos + 60 gerações | ≈ US$ 0,38 |
| Limite atual do gratuito (5 fotos + 15 gerações por dia, todos os dias) | 150 + 450 | ≈ US$ 2,50 |
| Limite atual do premium (40 + 120 por dia) | 1.200 + 3.600 | ≈ US$ 20 |

**Recomendação:** os limites diários do plano gratuito (5/15) protegem contra abuso, mas permitem um pior caso alto. Antes do lançamento, adote também um **teto mensal** (por exemplo, 40 fotos e 100 gerações no gratuito) ou reduza o diário para 3/10. Os limites ficam na tabela `plan_limits` e mudam sem publicar o app.

Infraestrutura: o plano Free do Supabase atende o MVP (o projeto pausa após 1 semana sem uso). Para produção, use o Pro (a partir de US$ 25/mês; confira em supabase.com/pricing os limites incluídos de usuários ativos e invocações de funções).

## Modelo freemium sugerido

| | Gratuito | Premium (sugestão: R$ 14,90/mês ou R$ 119/ano) |
|---|---|---|
| Análises de foto | 3–5 por dia (com teto mensal) | 40 por dia |
| Geração de receitas | 10–15 por dia | 120 por dia |
| Geladeira, favoritos, lista de compras | ✔ | ✔ |
| Histórico | Últimos 30 dias | Completo |
| Filtros avançados e prioridade de vencimento | Básico | ✔ |
| Planejamento semanal e cardápios | — | ✔ (roadmap) |
| Lista de compras do cardápio completo | — | ✔ (roadmap) |

Com custo de IA de US$ 0,40 a 2 por assinante ativo e taxas das lojas de 15–30%, R$ 14,90 deixa margem saudável. Outras fontes, sem prejudicar a experiência: parcerias com mercados (comissão por lista enviada) e receitas patrocinadas claramente identificadas.

**Ainda não há cobrança real no app**: o card Premium aparece como "em breve". Para ativar: RevenueCat (ou StoreKit/Play Billing) → webhook → Edge Function com service role atualiza `profiles.plan`.

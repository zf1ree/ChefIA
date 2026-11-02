import type { GenerateRecipesParams } from '../domain/schemas.ts';
import { isExpiringSoon } from '../domain/expiry.ts';

export const VISION_SYSTEM = `Você é um assistente de cozinha que identifica alimentos em fotos de geladeiras, congeladores, despensas e bancadas.

Regras obrigatórias:
- Liste SOMENTE alimentos que você consegue ver com clareza. Nunca invente itens.
- Não presuma o conteúdo de embalagens fechadas, potes opacos, gavetas fechadas ou itens escondidos. Se um rótulo legível indicar o produto, você pode listá-lo com confiança moderada.
- "confidence" vai de 0 a 1: 0.9+ quando o item é inequívoco; 0.5–0.8 quando é provável; abaixo de 0.5 quando é um palpite. Prefira omitir palpites muito fracos.
- Use nomes simples em português do Brasil, no singular, sem marcas (ex.: "Ovo", "Tomate", "Queijo muçarela", "Leite").
- "quantity_estimate" só quando visível (ex.: "6 unidades", "1 caixa", "meio pacote"); caso contrário null.
- "location_hint": fridge, freezer ou pantry, se for possível inferir pelo ambiente; senão null.
- Não estime validade nem condição de consumo do alimento.
- Avalie a qualidade da imagem. Se estiver escura, desfocada, distante demais, obstruída ou sem alimentos, marque usable=false, informe o "issue" e explique em "message" (em português, 1 frase, com uma dica prática para a nova foto). Se a imagem for utilizável, issue="none" e message curta.
- "notes": observações úteis (ex.: "Há potes fechados cujo conteúdo não é visível") ou null.`;

export const VISION_USER = 'Identifique os alimentos visíveis nesta foto e avalie a qualidade da imagem.';

export interface RecipePromptProfile {
  allergies: string[];
  dietary_restrictions: string[];
  disliked_ingredients: string[];
  cuisine_preferences: string[];
  pantry_staples: string[];
  liked_titles: string[];
  disliked_titles: string[];
}

const SHOPPING_TEXT: Record<GenerateRecipesParams['shopping'], string> = {
  none: 'O usuário NÃO quer ir ao mercado: use apenas os ingredientes disponíveis e os básicos confirmados (ingredientes opcionais são permitidos se marcados optional=true).',
  one: 'O usuário aceita comprar no máximo 1 ingrediente por receita.',
  few: 'O usuário aceita comprar até 3 ingredientes por receita, mas prefira receitas que usem só o que ele tem.',
  any: 'O usuário aceita comprar ingredientes, mas priorize o que ele já tem.',
};

const MEAL_TEXT: Record<string, string> = {
  cafe_da_manha: 'café da manhã',
  almoco: 'almoço',
  jantar: 'jantar',
  lanche: 'lanche',
  sobremesa: 'sobremesa',
};

export function recipesSystemPrompt(): string {
  return `Você é um chef brasileiro experiente e nutricionista prático. Crie receitas reais, executáveis em uma cozinha doméstica, em português do Brasil.

Regras obrigatórias:
- Priorize os ingredientes do inventário do usuário. Cada receita deve usar pelo menos 2 itens do inventário quando possível.
- Para cada ingrediente da receita, preencha "matched_inventory_item" com o nome EXATO do item do inventário usado, ou null se o usuário não tem.
- Não presuma que o usuário tem sal, óleo, temperos ou qualquer item fora do inventário e da lista de básicos confirmados. Itens básicos (sal, óleo, açúcar, água, pimenta) devem ter is_basic_staple=true. Água da torneira pode ser usada livremente (is_basic_staple=true).
- Quantidades coerentes com o número de porções. Use unidades brasileiras (g, kg, ml, xícara, colher de sopa, colher de chá, unidade, pitada). "display_quantity" é o texto legível, ex.: "2 unidades", "1/2 xícara", "a gosto".
- Passos claros, numerados implicitamente, com tempo em minutos quando houver cocção/espera. Nada de combinações impossíveis ou técnicas perigosas.
- Tempos realistas: prep_minutes (preparo) e cook_minutes (cozimento).
- ALERGIAS E RESTRIÇÕES SÃO INEGOCIÁVEIS: nunca inclua ingredientes que as violem, nem como opcionais ou substituições. Em "allergen_notes", alerte sobre possíveis traços/contaminação cruzada relevantes (ex.: "Verifique no rótulo da aveia se é certificada sem glúten").
- Evite os ingredientes que o usuário não gosta.
- nutrition_per_serving é uma estimativa aproximada; use null se não for possível estimar com razoabilidade.
- substitutions: trocas práticas para ingredientes que faltam ou restrições.
- tags: marque apenas as que realmente se aplicam.
- Gere entre 4 e 6 receitas variadas (não repita a mesma preparação com nomes diferentes).`;
}

export function recipesUserPrompt(
  params: GenerateRecipesParams,
  profile: RecipePromptProfile,
  today: string,
  servings: number,
  maxMinutes: number | null,
): string {
  const inventory = params.ingredients
    .map((i) => {
      const parts = [`- ${i.name}`];
      if (i.quantity) parts.push(`(quantidade: ${i.quantity})`);
      if (isExpiringSoon(i.expires_on, today)) parts.push('[VENCE EM BREVE — priorize]');
      return parts.join(' ');
    })
    .join('\n');

  const lines = [
    `Inventário do usuário:\n${inventory}`,
    `Itens básicos confirmados: ${profile.pantry_staples.length ? profile.pantry_staples.join(', ') : 'nenhum (não presuma sal, óleo nem temperos)'}`,
    `Porções: ${servings}`,
    maxMinutes ? `Tempo máximo total (preparo + cozimento): ${maxMinutes} minutos` : null,
    params.meal_type ? `Refeição: ${MEAL_TEXT[params.meal_type]}` : null,
    params.tags.length ? `Estilo desejado (tags): ${params.tags.join(', ')}` : null,
    SHOPPING_TEXT[params.shopping],
    params.prioritize_expiring ? 'Priorize fortemente os itens marcados como VENCE EM BREVE.' : null,
    profile.allergies.length ? `ALERGIAS (proibido): ${profile.allergies.join(', ')}` : 'Alergias: nenhuma informada.',
    profile.dietary_restrictions.length ? `RESTRIÇÕES (obrigatório respeitar): ${profile.dietary_restrictions.join(', ')}` : null,
    profile.disliked_ingredients.length ? `Não gosta de: ${profile.disliked_ingredients.join(', ')}` : null,
    profile.cuisine_preferences.length ? `Preferências culinárias: ${profile.cuisine_preferences.join(', ')}` : null,
    profile.liked_titles.length ? `Receitas que o usuário avaliou bem (inspire-se no estilo): ${profile.liked_titles.join('; ')}` : null,
    profile.disliked_titles.length ? `Receitas que não agradaram (evite parecidas): ${profile.disliked_titles.join('; ')}` : null,
  ];
  return lines.filter(Boolean).join('\n\n');
}

// Filtro de segurança alimentar (camada extra, NÃO substitui a leitura de rótulos).
// A IA recebe as alergias no prompt; aqui verificamos de novo a saída, de forma
// conservadora, e descartamos receitas que contenham termos associados.
import { normalizeName, tokens } from './normalize.ts';

export const ALLERGY_OPTIONS = [
  { key: 'leite', label: 'Leite / lactose' },
  { key: 'gluten', label: 'Glúten / trigo' },
  { key: 'ovo', label: 'Ovo' },
  { key: 'amendoim', label: 'Amendoim' },
  { key: 'castanhas', label: 'Castanhas e nozes' },
  { key: 'frutos_do_mar', label: 'Frutos do mar' },
  { key: 'peixe', label: 'Peixe' },
  { key: 'soja', label: 'Soja' },
  { key: 'gergelim', label: 'Gergelim' },
] as const;

export const RESTRICTION_OPTIONS = [
  { key: 'vegetariana', label: 'Vegetariana' },
  { key: 'vegana', label: 'Vegana' },
  { key: 'sem_lactose', label: 'Sem lactose' },
  { key: 'sem_gluten', label: 'Sem glúten' },
  { key: 'low_carb', label: 'Low carb' },
  { key: 'sem_carne_porco', label: 'Sem carne de porco' },
] as const;

const MEAT = [
  'carne', 'frango', 'peito de frango', 'coxa', 'sobrecoxa', 'presunto', 'bacon', 'linguica', 'salsicha',
  'calabresa', 'mortadela', 'salame', 'peru', 'carne moida', 'bife', 'patinho', 'alcatra', 'costela',
  'lombo', 'pernil', 'file mignon', 'acem', 'musculo', 'cupim', 'picanha', 'figado', 'toucinho', 'banha',
  'caldo de carne', 'caldo de galinha', 'galinha', 'pato', 'cordeiro', 'chester', 'peito de peru',
];
const FISH = ['peixe', 'atum', 'sardinha', 'tilapia', 'salmao', 'bacalhau', 'anchova', 'merluza', 'pescada', 'truta', 'cação'];
const SEAFOOD = ['camarao', 'lula', 'polvo', 'mexilhao', 'marisco', 'lagosta', 'caranguejo', 'siri', 'ostra', 'vieira'];
const DAIRY = [
  'leite', 'queijo', 'manteiga', 'iogurte', 'requeijao', 'creme de leite', 'nata', 'lactose', 'mucarela',
  'mussarela', 'parmesao', 'ricota', 'cream cheese', 'leite condensado', 'chantilly', 'whey', 'coalhada',
  'catupiry', 'cheddar', 'provolone', 'gorgonzola', 'doce de leite', 'leite em po', 'soro de leite', 'ghee',
];
const GLUTEN = [
  'trigo', 'farinha de trigo', 'pao', 'macarrao', 'massa', 'cevada', 'centeio', 'malte', 'aveia', 'biscoito',
  'bolacha', 'torrada', 'tortilha', 'cuscuz marroquino', 'farinha de rosca', 'empanado', 'lasanha',
  'espaguete', 'penne', 'nhoque', 'pizza', 'semolina', 'bulgur', 'trigo para quibe', 'cerveja', 'shoyu',
];
const EGG = ['ovo', 'gema', 'clara', 'maionese', 'merengue'];
const PEANUT = ['amendoim', 'pasta de amendoim', 'pacoca'];
const NUTS = ['castanha', 'noz', 'nozes', 'amendoa', 'avela', 'pistache', 'macadamia', 'castanha de caju', 'castanha do para', 'peca'];
const SOY = ['soja', 'tofu', 'shoyu', 'molho de soja', 'edamame', 'misso', 'proteina de soja', 'leite de soja'];
const SESAME = ['gergelim', 'tahine', 'tahini'];
const PORK = ['porco', 'bacon', 'presunto', 'linguica', 'calabresa', 'lombo', 'pernil', 'toucinho', 'banha', 'salame', 'mortadela', 'costelinha suina', 'panceta'];

/** Termos que, se presentes em um ingrediente, entram em conflito com a chave. */
export const CONFLICT_TERMS: Record<string, readonly string[]> = {
  leite: DAIRY,
  sem_lactose: DAIRY.filter((t) => t !== 'ghee'),
  gluten: GLUTEN,
  sem_gluten: GLUTEN,
  ovo: EGG,
  amendoim: PEANUT,
  castanhas: NUTS,
  frutos_do_mar: SEAFOOD,
  peixe: FISH,
  soja: SOY,
  gergelim: SESAME,
  vegetariana: [...MEAT, ...FISH, ...SEAFOOD, 'gelatina'],
  vegana: [...MEAT, ...FISH, ...SEAFOOD, ...DAIRY, ...EGG, 'mel', 'gelatina'],
  sem_carne_porco: PORK,
};

/** Termos com exceção explícita: "leite de coco" não é laticínio, "manteiga de cacau" idem. */
const EXCEPTIONS: Record<string, readonly string[]> = {
  leite: ['leite de coco', 'leite de amendoa', 'leite de aveia', 'leite de soja', 'leite de arroz', 'manteiga de cacau', 'manteiga de amendoim'],
  sem_lactose: ['leite de coco', 'leite de amendoa', 'leite de aveia', 'leite de soja', 'leite de arroz', 'manteiga de cacau', 'manteiga de amendoim', 'leite sem lactose', 'queijo sem lactose', 'iogurte sem lactose'],
  vegana: ['leite de coco', 'leite de amendoa', 'leite de aveia', 'leite de soja', 'leite de arroz', 'manteiga de cacau', 'queijo vegano'],
  vegetariana: ['carne de soja', 'carne vegetal', 'proteina de soja'],
  gluten: ['massa de tomate', 'pao de queijo', 'macarrao de arroz', 'massa sem gluten', 'pao sem gluten', 'aveia sem gluten', 'shoyu sem gluten'],
  sem_gluten: ['massa de tomate', 'pao de queijo', 'macarrao de arroz', 'massa sem gluten', 'pao sem gluten', 'aveia sem gluten', 'shoyu sem gluten'],
};

function containsPhrase(haystackTokens: string[], phrase: string): boolean {
  const p = tokens(phrase);
  if (p.length === 0) return false;
  for (let i = 0; i + p.length <= haystackTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) {
      if (haystackTokens[i + j] !== p[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Aceita a chave canônica ("frutos_do_mar") ou variações digitadas ("Frutos do mar"). */
function resolveKey(rawKey: string): string {
  const direct = rawKey.trim().toLowerCase();
  if (direct in CONFLICT_TERMS) return direct;
  const n = normalizeName(rawKey);
  return Object.keys(CONFLICT_TERMS).find((k) => normalizeName(k.replace(/_/g, ' ')) === n) ?? direct;
}

function isException(key: string, ingredient: string): boolean {
  const n = normalizeName(ingredient);
  return (EXCEPTIONS[key] ?? []).some((e) => n.includes(normalizeName(e)));
}

/**
 * Retorna as chaves de alergia/restrição violadas por um ingrediente.
 * Chaves desconhecidas (texto livre, ex.: "kiwi") são comparadas literalmente.
 */
export function conflictsFor(ingredient: string, keys: readonly string[]): string[] {
  const ingTokens = tokens(ingredient);
  const hits: string[] = [];
  for (const rawKey of keys) {
    const key = resolveKey(rawKey);
    const terms = CONFLICT_TERMS[key] ?? [rawKey];
    if (isException(key, ingredient)) continue;
    if (terms.some((t) => containsPhrase(ingTokens, t))) hits.push(rawKey);
  }
  return hits;
}

export interface SafetyCheck {
  safe: boolean;
  conflicts: { ingredient: string; keys: string[] }[];
}

/** Verifica todos os ingredientes (inclusive opcionais) contra alergias + restrições + itens evitados. */
export function checkRecipeSafety(ingredientNames: readonly string[], keys: readonly string[]): SafetyCheck {
  const conflicts: SafetyCheck['conflicts'] = [];
  if (keys.length === 0) return { safe: true, conflicts };
  for (const name of ingredientNames) {
    const hit = conflictsFor(name, keys);
    if (hit.length) conflicts.push({ ingredient: name, keys: hit });
  }
  return { safe: conflicts.length === 0, conflicts };
}

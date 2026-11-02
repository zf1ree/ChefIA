// Normalização de nomes de ingredientes (pt-BR) para comparação e deduplicação.
// Código puro, compartilhado entre o app (Expo) e as Edge Functions (Deno).

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'e', 'a', 'o', 'com', 'para', 'ao']);

function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('oes') || word.endsWith('aes')) return word.slice(0, -3) + 'ao';
  if (word.endsWith('ns')) return word.slice(0, -2) + 'm';
  if (word.endsWith('res') || word.endsWith('zes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** "Tomates  Cereja" -> "tomate cereja"; "Pães" -> "pao"; "Feijão" -> "feijao". */
export function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize)
    .join(' ');
}

export function tokens(raw: string): string[] {
  return normalizeName(raw)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t));
}

/**
 * O usuário possui `available` para cumprir a necessidade `needed`?
 * Regra conservadora: nomes iguais, ou todas as palavras do item disponível
 * aparecem no ingrediente pedido ("queijo" cobre "queijo ralado").
 * "leite condensado" NÃO cobre "leite".
 */
export function covers(available: string, needed: string): boolean {
  const a = tokens(available);
  const n = tokens(needed);
  if (a.length === 0 || n.length === 0) return false;
  if (a.join(' ') === n.join(' ')) return true;
  const nSet = new Set(n);
  return a.every((t) => nSet.has(t));
}

/** Primeiro item disponível que cobre a necessidade, ou null. */
export function findCovering(availableNames: readonly string[], needed: string): string | null {
  for (const name of availableNames) {
    if (covers(name, needed)) return name;
  }
  return null;
}

/** Remove duplicados mantendo a primeira grafia. */
export function dedupeNames<T extends { name: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = normalizeName(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

import { covers, dedupeNames, findCovering, normalizeName } from '@shared/normalize';

describe('normalizeName', () => {
  it('remove acentos, caixa e plural', () => {
    expect(normalizeName('Tomates')).toBe('tomate');
    expect(normalizeName('Pães')).toBe('pao');
    expect(normalizeName('Limões')).toBe('limao');
    expect(normalizeName('Feijão')).toBe('feijao');
    expect(normalizeName('  Queijo   Muçarela ')).toBe('queijo mucarela');
    expect(normalizeName('Ovos')).toBe('ovo');
  });

  it('mantém palavras curtas', () => {
    expect(normalizeName('Gás')).toBe('gas');
  });
});

describe('covers', () => {
  it('itens iguais ou plural', () => {
    expect(covers('Ovo', 'ovos')).toBe(true);
    expect(covers('Tomate', 'tomates maduros')).toBe(true);
  });

  it('item genérico cobre variação específica', () => {
    expect(covers('Queijo', 'queijo ralado')).toBe(true);
  });

  it('não confunde produtos diferentes com a mesma palavra', () => {
    expect(covers('Leite condensado', 'leite')).toBe(false);
    expect(covers('Creme de leite', 'leite')).toBe(false);
    expect(covers('Queijo muçarela', 'queijo parmesão')).toBe(false);
  });

  it('ignora stopwords', () => {
    expect(covers('Peito de frango', 'peito frango')).toBe(true);
  });
});

describe('findCovering / dedupeNames', () => {
  it('encontra o item correto no inventário', () => {
    expect(findCovering(['Leite condensado', 'Leite'], 'leite integral')).toBe('Leite');
    expect(findCovering(['Cebola'], 'alho')).toBeNull();
  });

  it('remove duplicados por nome normalizado', () => {
    const out = dedupeNames([{ name: 'Ovos' }, { name: 'ovo' }, { name: 'Tomate' }]);
    expect(out.map((o) => o.name)).toEqual(['Ovos', 'Tomate']);
  });
});

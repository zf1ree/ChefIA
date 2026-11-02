import { daysUntil, expiryLabel, expiryStatus, isExpiringSoon, todayIso } from '@shared/expiry';
import { checkRecipeSafety, conflictsFor } from '@shared/safety';

describe('conflictsFor (alergias e restrições)', () => {
  it('detecta laticínios para alergia a leite', () => {
    expect(conflictsFor('Queijo muçarela', ['leite'])).toEqual(['leite']);
    expect(conflictsFor('Manteiga', ['leite'])).toEqual(['leite']);
  });

  it('respeita exceções conhecidas', () => {
    expect(conflictsFor('Leite de coco', ['leite'])).toEqual([]);
    expect(conflictsFor('Pão de queijo', ['gluten'])).toEqual([]);
    expect(conflictsFor('Massa de tomate', ['gluten'])).toEqual([]);
  });

  it('vegetariano bloqueia carnes, permite ovos', () => {
    expect(conflictsFor('Presunto', ['vegetariana'])).toEqual(['vegetariana']);
    expect(conflictsFor('Ovo', ['vegetariana'])).toEqual([]);
  });

  it('vegano bloqueia ovos, mel e laticínios', () => {
    expect(conflictsFor('Ovos', ['vegana'])).toEqual(['vegana']);
    expect(conflictsFor('Mel', ['vegana'])).toEqual(['vegana']);
    expect(conflictsFor('Iogurte natural', ['vegana'])).toEqual(['vegana']);
    expect(conflictsFor('Leite de aveia', ['vegana'])).toEqual([]);
  });

  it('itens de texto livre são comparados literalmente', () => {
    expect(conflictsFor('Coentro picado', ['coentro'])).toEqual(['coentro']);
    expect(conflictsFor('Salsinha', ['coentro'])).toEqual([]);
  });

  it('resolve chaves com plural/underscore e texto digitado', () => {
    expect(conflictsFor('Camarão', ['frutos_do_mar'])).toEqual(['frutos_do_mar']);
    expect(conflictsFor('Castanha de caju', ['castanhas'])).toEqual(['castanhas']);
    expect(conflictsFor('Camarões', ['Frutos do mar'])).toEqual(['Frutos do mar']);
    expect(conflictsFor('Bacon', ['sem_carne_porco'])).toEqual(['sem_carne_porco']);
  });

  it('não gera falso positivo por substring', () => {
    // "ovo" não deve casar com "ovomaltine" nem "novo"
    expect(conflictsFor('Pão novo', ['ovo'])).toEqual([]);
  });
});

describe('checkRecipeSafety', () => {
  it('lista todos os conflitos', () => {
    const r = checkRecipeSafety(['Ovo', 'Farinha de trigo', 'Tomate'], ['ovo', 'gluten']);
    expect(r.safe).toBe(false);
    expect(r.conflicts).toHaveLength(2);
  });

  it('sem chaves é sempre seguro', () => {
    expect(checkRecipeSafety(['Amendoim'], []).safe).toBe(true);
  });
});

describe('validade', () => {
  const today = '2026-10-10';

  it('calcula dias e status', () => {
    expect(daysUntil('2026-10-13', today)).toBe(3);
    expect(expiryStatus('2026-10-13', today)).toBe('soon');
    expect(expiryStatus('2026-10-14', today)).toBe('ok');
    expect(expiryStatus('2026-10-10', today)).toBe('today');
    expect(expiryStatus('2026-10-09', today)).toBe('expired');
    expect(expiryStatus(null, today)).toBe('unknown');
    expect(expiryStatus('lixo', today)).toBe('unknown');
  });

  it('atravessa mudança de mês/ano corretamente', () => {
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
  });

  it('isExpiringSoon e rótulos', () => {
    expect(isExpiringSoon('2026-10-11', today)).toBe(true);
    expect(isExpiringSoon('2026-10-01', today)).toBe(false);
    expect(expiryLabel('2026-10-11', today)).toBe('Vence amanhã');
    expect(expiryLabel('2026-10-05', today)).toBe('Venceu há 5 dias');
  });

  it('todayIso usa data local', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

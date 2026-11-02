// Validade informada pelo usuário. Nunca inferimos validade a partir de fotos.

export type ExpiryStatus = 'expired' | 'today' | 'soon' | 'ok' | 'unknown';

/** Dias considerados "próximo do vencimento". */
export const EXPIRING_SOON_DAYS = 3;

function parseIsoDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t;
}

/** "Hoje" no fuso local do dispositivo, como YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysUntil(expiresOn: string | null | undefined, today: string): number | null {
  if (!expiresOn) return null;
  const e = parseIsoDate(expiresOn);
  const t = parseIsoDate(today);
  if (e === null || t === null) return null;
  return Math.round((e - t) / 86_400_000);
}

export function expiryStatus(expiresOn: string | null | undefined, today: string): ExpiryStatus {
  const d = daysUntil(expiresOn, today);
  if (d === null) return 'unknown';
  if (d < 0) return 'expired';
  if (d === 0) return 'today';
  if (d <= EXPIRING_SOON_DAYS) return 'soon';
  return 'ok';
}

export function isExpiringSoon(expiresOn: string | null | undefined, today: string): boolean {
  const s = expiryStatus(expiresOn, today);
  return s === 'today' || s === 'soon';
}

export function expiryLabel(expiresOn: string | null | undefined, today: string): string | null {
  const d = daysUntil(expiresOn, today);
  if (d === null) return null;
  if (d < -1) return `Venceu há ${-d} dias`;
  if (d === -1) return 'Venceu ontem';
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  return `Vence em ${d} dias`;
}

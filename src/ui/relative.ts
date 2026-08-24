/**
 * Timestamps relativos e objetivos, como manda o brief: "há 31 min",
 * "Ontem · 14 ago". Nunca frase motivacional, nunca data por extenso.
 */

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24 && then.getDate() === now.getDate()) return `há ${hours} h`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (then.getDate() === yesterday.getDate() && then.getMonth() === yesterday.getMonth()) {
    return `Ontem · ${shortDate(then)}`;
  }

  return shortDate(then);
}

/** "14 ago" — e "14 ago 25" quando o ano nao e o atual. */
export function shortDate(date: Date, now = new Date()): string {
  const base = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  if (date.getFullYear() === now.getFullYear()) return base;
  return `${base} ${String(date.getFullYear()).slice(2)}`;
}

/** Duracao de um treino: "48 min", "1 h 12". */
export function duration(startIso: string, endIso: string): string {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

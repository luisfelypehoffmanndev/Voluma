/**
 * O tempo de um treino, contado a partir do `started_at` da sessao.
 *
 * Puro e sem relogio proprio: quem chama passa o "agora", e e isso que deixa o
 * teste fixar o instante e o HUD redesenhar a cada segundo sem estado.
 */

/**
 * Acima disto o numero e quase certamente lixo, nao um treino: sessoes antigas
 * nasciam com `started_at` na hora da criacao, que podia ser de manha para um
 * treino a noite (ver `startSession` no repo). Melhor um traco que "9:41:12".
 */
export const MAX_PLAUSIBLE_MS = 5 * 60 * 60 * 1000;

/**
 * Milissegundos de treino: ate `completedAt` se o treino acabou, ate `now` se
 * nao. `null` quando o numero nao e confiavel (negativo ou longo demais).
 */
export function elapsedMs(
  startedAt: string,
  completedAt: string | null,
  now: number,
): number | null {
  const start = Date.parse(startedAt);
  const end = completedAt ? Date.parse(completedAt) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const elapsed = end - start;
  if (elapsed < 0 || elapsed > MAX_PLAUSIBLE_MS) return null;
  return elapsed;
}

/** "4:07", "24:15", "1:02:09" — relogio de painel, sem unidade. */
export function formatClock(ms: number | null): string {
  if (ms === null) return '—';
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

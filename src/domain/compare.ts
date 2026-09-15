/**
 * Comparar o volume de um treino com o anterior do mesmo dia da semana.
 *
 * Mesmo dia da semana, e nao "o ultimo treino": segunda de pernas contra sexta
 * de braco nao diz nada. A tela de resultado mostra isto em texto e seta,
 * nunca em verde ou vermelho — cair 3% num deload nao e "erro".
 */

export type VolumeComparison =
  | { direction: 'up' | 'down'; percent: number }
  | { direction: 'same'; percent: 0 };

/**
 * `null` quando nao ha base: sem treino anterior, ou um anterior sem volume
 * (so corrida, so exercicio sem carga). Dividir por zero daria "infinito %", e
 * a tela diz "primeira segunda registrada" em vez disso.
 *
 * O percentual e arredondado para inteiro; o que arredonda para 0 vira `same`,
 * para nao mostrar "▲ 0%".
 */
export function compareVolume(current: number, previous: number | null): VolumeComparison | null {
  if (previous == null || previous <= 0) return null;

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { direction: 'same', percent: 0 };
  return { direction: percent > 0 ? 'up' : 'down', percent: Math.abs(percent) };
}

/** "▲ 8%", "▼ 3%", "= igual". Seta e texto em branco — a cor nao carrega o sentido. */
export function formatComparison(comparison: VolumeComparison): string {
  if (comparison.direction === 'same') return '= mesmo volume';
  return `${comparison.direction === 'up' ? '▲' : '▼'} ${comparison.percent}%`;
}

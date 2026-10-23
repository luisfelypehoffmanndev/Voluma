/**
 * Regras puras da aba Planos: como resumir a semana, o estado de cada aluno no
 * plano e o que a previa da atribuicao manda substituir.
 */
import type { Weekday } from '@domain/types';
import { weekdayName } from '@domain/week';

export type PlanDayRow = { weekday: number; preset_id: string };

/** "Seg Treino A · Qua Treino B" na ordem da semana. */
export function weekSummary(days: readonly PlanDayRow[], presetName: (id: string) => string): string {
  if (days.length === 0) return 'Nenhum dia';
  return [...days]
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => `${shortDay(d.weekday)} ${presetName(d.preset_id)}`)
    .join(' · ');
}

export function shortDay(weekday: number): string {
  return weekdayName(weekday as Weekday).slice(0, 3);
}

export type PlanMember = {
  user_id: string;
  plan_days: number;
  following_days: number;
  customized_days: number;
};

/** Como o aluno esta no plano, para a tabela de alunos do plano. */
export function memberStatus(member: PlanMember): string {
  if (member.following_days < member.plan_days) {
    return `Parcial: ${member.following_days} de ${member.plan_days} dias`;
  }
  if (member.customized_days > 0) {
    return member.customized_days === 1 ? 'Com exceção em 1 dia' : `Com exceções em ${member.customized_days} dias`;
  }
  return 'Em dia';
}

/** Uma linha da previa (`staff_assign_plan` com `dry_run`). */
export type PreviewRow = {
  user_id: string;
  weekday: number;
  current: 'empty' | 'same_plan' | 'own' | 'instructor' | 'preset' | 'other_plan';
  current_name: string | null;
  action: 'apply' | 'skip' | 'unchanged';
};

export const CURRENT_LABEL: Record<PreviewRow['current'], string> = {
  empty: 'Dia livre',
  same_plan: 'Já está no plano',
  own: 'Treino do aluno',
  instructor: 'Treino prescrito',
  preset: 'Ficha',
  other_plan: 'Outro plano',
};

/** O dia tem algo que o plano substituiria: o instrutor precisa decidir. */
export function isConflict(row: Pick<PreviewRow, 'current'>): boolean {
  return row.current !== 'empty' && row.current !== 'same_plan';
}

export const pairKey = (userId: string, weekday: number) => `${userId}/${weekday}`;

/** O `replace` da RPC: so os conflitos que o instrutor marcou para substituir. */
export function buildReplace(rows: readonly PreviewRow[], chosen: ReadonlySet<string>) {
  return rows
    .filter((row) => isConflict(row) && chosen.has(pairKey(row.user_id, row.weekday)))
    .map((row) => ({ user_id: row.user_id, weekday: row.weekday }));
}

/** Quantos dias entram se aplicar agora: os livres e os conflitos marcados. */
export function countToApply(rows: readonly PreviewRow[], chosen: ReadonlySet<string>): number {
  return rows.filter((row) => row.current === 'empty' || (isConflict(row) && chosen.has(pairKey(row.user_id, row.weekday))))
    .length;
}

/** Pedacos de ate `size`: a RPC aceita no maximo 500 alunos por chamada. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Um id de movimento para o treino, a partir do nome, quando nao vem da biblioteca. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

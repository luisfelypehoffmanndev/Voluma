import { describe, expect, it } from 'vitest';

import { MOVEMENTS, movementBySlug } from '../movements';
import {
  buildReplace,
  chunk,
  countToApply,
  isConflict,
  memberStatus,
  pairKey,
  slugify,
  weekSummary,
  type PreviewRow,
} from '../plans';

const row = (user_id: string, weekday: number, current: PreviewRow['current']): PreviewRow => ({
  user_id,
  weekday,
  current,
  current_name: null,
  action: current === 'empty' ? 'apply' : current === 'same_plan' ? 'unchanged' : 'skip',
});

describe('weekSummary', () => {
  it('resume na ordem da semana, com o nome do treino', () => {
    const names: Record<string, string> = { a: 'Treino A', b: 'Treino B' };
    expect(
      weekSummary(
        [
          { weekday: 3, preset_id: 'b' },
          { weekday: 1, preset_id: 'a' },
        ],
        (id) => names[id],
      ),
    ).toBe('Seg Treino A · Qua Treino B');
    expect(weekSummary([], () => '')).toBe('Nenhum dia');
  });
});

describe('memberStatus', () => {
  const base = { user_id: 'u', plan_days: 3, following_days: 3, customized_days: 0 };
  it('em dia, com excecao e parcial', () => {
    expect(memberStatus(base)).toBe('Em dia');
    expect(memberStatus({ ...base, customized_days: 1 })).toBe('Com exceção em 1 dia');
    expect(memberStatus({ ...base, customized_days: 2 })).toBe('Com exceções em 2 dias');
    expect(memberStatus({ ...base, following_days: 2 })).toBe('Parcial: 2 de 3 dias');
  });

  it('parcial ganha de excecao: o aluno saiu de um dia', () => {
    expect(memberStatus({ ...base, following_days: 1, customized_days: 1 })).toBe('Parcial: 1 de 3 dias');
  });
});

describe('previa da atribuicao', () => {
  const rows = [row('ana', 1, 'empty'), row('bia', 1, 'own'), row('bia', 3, 'other_plan'), row('caio', 1, 'same_plan')];

  it('so dia ocupado por outra coisa e conflito', () => {
    expect(rows.map(isConflict)).toEqual([false, true, true, false]);
  });

  it('o replace leva so os conflitos marcados', () => {
    const chosen = new Set([pairKey('bia', 3), pairKey('ana', 1), pairKey('caio', 1)]);
    expect(buildReplace(rows, chosen)).toEqual([{ user_id: 'bia', weekday: 3 }]);
    expect(countToApply(rows, chosen)).toBe(2);
    expect(countToApply(rows, new Set())).toBe(1);
  });
});

describe('chunk e slugify', () => {
  it('quebra em pedacos', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it('slug sem acento e sem espaco', () => {
    expect(slugify('Puxada na Máquina!')).toBe('puxada-na-maquina');
  });
});

describe('biblioteca de movimentos do app', () => {
  it('traz nome em portugues, grupo e corrida', () => {
    expect(movementBySlug('bench-press')).toMatchObject({ name: 'Supino reto', kind: 'strength' });
    expect(MOVEMENTS.some((m) => m.kind === 'run')).toBe(true);
    expect(MOVEMENTS.length).toBeGreaterThan(50);
  });
});

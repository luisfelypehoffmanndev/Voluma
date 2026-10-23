import { describe, expect, it } from 'vitest';

import { dayLink, lastTrainedLabel, matchesSearch, studentName, type StudentRow } from '../students';

const row = (overrides: Partial<StudentRow> = {}): StudentRow => ({
  user_id: '9f0cc84b-c3b7-4abc-b919-df02d6a70cb3',
  display_name: 'Luís Felype',
  handle: 'luis.felype',
  preset_ids: [],
  prescribed_days: 0,
  self_edited_days: 0,
  planned_days: 0,
  trained_days: 0,
  last_trained_on: null,
  ...overrides,
});

describe('dayLink', () => {
  it('prescrito ganha de tudo', () => {
    expect(dayLink({ prescribed_by: 'i1', prescribed_at: 't', preset_id: null })).toBe('instructor');
  });

  it('ficha, editado pelo aluno e do aluno', () => {
    expect(dayLink({ prescribed_by: null, prescribed_at: null, preset_id: 'p1' })).toBe('preset');
    expect(dayLink({ prescribed_by: null, prescribed_at: 't', preset_id: null })).toBe('self_edited');
    expect(dayLink({ prescribed_by: null, prescribed_at: null, preset_id: null })).toBe('own');
  });

  it('dia que adotou ficha depois de editado mostra a ficha', () => {
    expect(dayLink({ prescribed_by: null, prescribed_at: 't', preset_id: 'p1' })).toBe('preset');
  });
});

describe('studentName', () => {
  it('usa o nome, depois o @, depois o id', () => {
    expect(studentName(row())).toBe('Luís Felype');
    expect(studentName(row({ display_name: '  ' }))).toBe('@luis.felype');
    expect(studentName(row({ display_name: null, handle: null }))).toBe('Aluno 9f0cc8');
  });
});

describe('lastTrainedLabel', () => {
  it('hoje, ontem, há N dias e nunca', () => {
    expect(lastTrainedLabel('2026-10-23', '2026-10-23')).toBe('hoje');
    expect(lastTrainedLabel('2026-10-22', '2026-10-23')).toBe('ontem');
    expect(lastTrainedLabel('2026-10-13', '2026-10-23')).toBe('há 10 dias');
    expect(lastTrainedLabel(null, '2026-10-23')).toBe('nunca');
  });

  it('atravessa a virada do horario de verao sem errar o dia', () => {
    expect(lastTrainedLabel('2026-10-31', '2026-11-02')).toBe('há 2 dias');
  });
});

describe('matchesSearch', () => {
  it('acha por nome sem acento ou pelo @', () => {
    expect(matchesSearch(row(), 'luis')).toBe(true);
    expect(matchesSearch(row(), '@luis.fel')).toBe(true);
    expect(matchesSearch(row(), 'FELYPE')).toBe(true);
    expect(matchesSearch(row(), 'ana')).toBe(false);
    expect(matchesSearch(row(), '   ')).toBe(true);
  });
});

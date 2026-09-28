import { addWeeks, daysSinceMonthStart, fromDateKey, lastNDays, monthGrid, nextRoutine, routineForWeekday, toDateKey, weekPlan, weekRange, weekRangeLabel, weekStartKey, lastWeekKeys, monthRange, weekdayLabel, weekdayName, weekdayOf, weeksBetween, everyWeekday, lastWeekday } from '../week';
import type { Routine, Weekday } from '../types';
import { volumeByWeek } from '../volume';

function makeRoutine(overrides: Partial<Routine> & { weekday: Weekday }): Routine {
  return {
    id: `routine-${overrides.weekday}`,
    updatedAt: '2026-08-21T10:00:00.000Z',
    deletedAt: null,
    name: 'Treino',
    position: 0,
    ...overrides,
  };
}

describe('toDateKey', () => {
  it('usa a data local, nao UTC', () => {
    // 21/08/2026 as 22h locais. Em UTC-3 isso ja e 22/08 em UTC — a chave
    // precisa continuar sendo 21, senao o treino da noite cai no dia errado.
    const date = new Date(2026, 7, 21, 22, 0, 0);
    expect(toDateKey(date)).toBe('2026-08-21');
  });

  it('preenche mes e dia com zero a esquerda', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('fromDateKey', () => {
  it('faz o caminho de volta preservando o dia local', () => {
    const key = '2026-08-21';
    expect(toDateKey(fromDateKey(key))).toBe(key);
  });

  it('devolve meia-noite local', () => {
    const date = fromDateKey('2026-08-21');
    expect(date.getHours()).toBe(0);
    expect(date.getDate()).toBe(21);
  });
});

describe('weekdayOf / weekdayLabel', () => {
  it('21/08/2026 e uma sexta-feira', () => {
    expect(weekdayOf(new Date(2026, 7, 21))).toBe(5);
    expect(weekdayLabel(5)).toBe('Sextas');
  });
});

describe('routineForWeekday', () => {
  const routines = [
    makeRoutine({ weekday: 1, name: 'Costas + biceps' }),
    makeRoutine({ weekday: 5, name: 'Peito + triceps' }),
  ];

  it('encontra a rotina do dia', () => {
    expect(routineForWeekday(routines, 5)?.name).toBe('Peito + triceps');
  });

  it('retorna null em dia de descanso', () => {
    expect(routineForWeekday(routines, 3)).toBeNull();
  });

  it('ignora rotinas apagadas (soft delete)', () => {
    const deleted = [makeRoutine({ weekday: 5, deletedAt: '2026-08-20T10:00:00.000Z' })];
    expect(routineForWeekday(deleted, 5)).toBeNull();
  });

  it('desempata por position quando o dia tem mais de uma', () => {
    const two = [
      makeRoutine({ id: 'b', weekday: 2, name: 'Segunda opcao', position: 1 }),
      makeRoutine({ id: 'a', weekday: 2, name: 'Primeira opcao', position: 0 }),
    ];
    expect(routineForWeekday(two, 2)?.name).toBe('Primeira opcao');
  });
});

describe('nextRoutine', () => {
  const routines = [
    makeRoutine({ weekday: 1, name: 'Costas + biceps' }),
    makeRoutine({ weekday: 5, name: 'Peito + triceps' }),
  ];

  it('olha para frente sem contar o proprio dia', () => {
    // Sexta 21/08: a proxima e segunda, 3 dias a frente — nao a de hoje.
    const result = nextRoutine(routines, new Date(2026, 7, 21));
    expect(result?.routine.name).toBe('Costas + biceps');
    expect(result?.daysAhead).toBe(3);
  });

  it('atravessa a virada de semana', () => {
    // Sabado 22/08 -> segunda 24/08.
    expect(nextRoutine(routines, new Date(2026, 7, 22))?.daysAhead).toBe(2);
  });

  it('retorna null quando nao ha nenhuma rotina', () => {
    expect(nextRoutine([], new Date(2026, 7, 21))).toBeNull();
  });

  it('volta ao mesmo dia da semana quando so existe uma rotina', () => {
    const single = [makeRoutine({ weekday: 5, name: 'Peito + triceps' })];
    expect(nextRoutine(single, new Date(2026, 7, 21))?.daysAhead).toBe(7);
  });
});

describe('lastNDays', () => {
  it('termina no dia informado e inclui ele', () => {
    const keys = lastNDays(new Date(2026, 7, 21), 7);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-08-15');
    expect(keys[6]).toBe('2026-08-21');
  });

  it('atravessa a virada de mes', () => {
    const keys = lastNDays(new Date(2026, 7, 2), 3);
    expect(keys).toEqual(['2026-07-31', '2026-08-01', '2026-08-02']);
  });
});

describe('monthGrid', () => {
  it('alinha o dia 1 na coluna do seu dia da semana', () => {
    // 01/08/2026 e um sabado -> indice 6 na primeira semana.
    const weeks = monthGrid(2026, 7);
    expect(weeks[0].slice(0, 6).every((cell) => cell === null)).toBe(true);
    expect(weeks[0][6]).toBe('2026-08-01');
  });

  it('gera semanas sempre completas de 7 posicoes', () => {
    const weeks = monthGrid(2026, 7);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('cobre todos os dias do mes', () => {
    const days = monthGrid(2026, 7).flat().filter(Boolean);
    expect(days).toHaveLength(31);
  });

  it('lida com fevereiro de ano bissexto', () => {
    const days = monthGrid(2024, 1).flat().filter(Boolean);
    expect(days).toHaveLength(29);
  });
});

describe('daysSinceMonthStart', () => {
  it('conta ate o dia 1 do mes, incluindo hoje', () => {
    // 21/08 com 0 meses atras -> 01/08 a 21/08 = 21 dias.
    expect(daysSinceMonthStart(new Date(2026, 7, 21), 0)).toBe(21);
  });

  it('atravessa meses de tamanhos diferentes', () => {
    // 21/08 com 2 meses atras -> 01/06. jun 30 + jul 31 + 21 = 82.
    expect(daysSinceMonthStart(new Date(2026, 7, 21), 2)).toBe(82);
  });

  it('atravessa a virada do ano', () => {
    // 10/01/2026 com 1 mes atras -> 01/12/2025. dez 31 + 10 = 41.
    expect(daysSinceMonthStart(new Date(2026, 0, 10), 1)).toBe(41);
  });

  it('conta fevereiro bissexto corretamente', () => {
    // 2028 e bissexto: 01/02 a 01/03 sao 29 dias + 1.
    expect(daysSinceMonthStart(new Date(2028, 2, 1), 1)).toBe(30);
  });

  it('rende exatamente um dia quando e dia 1 e nao volta meses', () => {
    expect(daysSinceMonthStart(new Date(2026, 7, 1), 0)).toBe(1);
  });
});

describe('weekStartKey', () => {
  it('devolve o domingo da semana', () => {
    // Sexta 21/08/2026. O domingo dessa semana e 16/08.
    expect(weekStartKey(new Date(2026, 7, 21))).toBe('2026-08-16');
  });

  it('num domingo devolve o proprio dia', () => {
    expect(weekStartKey(new Date(2026, 7, 16))).toBe('2026-08-16');
  });

  it('num sabado ainda devolve o domingo anterior — a semana nao virou', () => {
    expect(weekStartKey(new Date(2026, 7, 22))).toBe('2026-08-16');
  });

  it('usa a data local, nao UTC', () => {
    // Domingo 16/08 as 22h. Em UTC-3 ja e 17/08 em UTC; a semana tem que
    // continuar comecando em 16, senao o treino da noite de domingo cai na
    // semana seguinte.
    expect(weekStartKey(new Date(2026, 7, 16, 22, 0, 0))).toBe('2026-08-16');
  });

  it('atravessa virada de mes', () => {
    // Terca 01/09/2026: o domingo dessa semana ainda esta em agosto.
    expect(weekStartKey(new Date(2026, 8, 1))).toBe('2026-08-30');
  });

  it('atravessa virada de ano', () => {
    // Sexta 01/01/2027: o domingo dessa semana e 27/12/2026.
    expect(weekStartKey(new Date(2027, 0, 1))).toBe('2026-12-27');
  });
});

describe('addWeeks', () => {
  it('anda para frente', () => {
    expect(addWeeks('2026-08-16', 1)).toBe('2026-08-23');
  });

  it('anda para tras', () => {
    expect(addWeeks('2026-08-16', -1)).toBe('2026-08-09');
  });

  it('atravessa virada de mes e de ano', () => {
    expect(addWeeks('2026-08-30', 1)).toBe('2026-09-06');
    expect(addWeeks('2026-12-27', 1)).toBe('2027-01-03');
  });

  it('zero semanas devolve a mesma chave', () => {
    expect(addWeeks('2026-08-16', 0)).toBe('2026-08-16');
  });
});

describe('weekRange', () => {
  it('num domingo comeca nele mesmo e termina no sabado seguinte', () => {
    // Domingo 16/08/2026.
    expect(weekRange(new Date(2026, 7, 16))).toEqual({ start: '2026-08-16', end: '2026-08-22' });
  });

  it('num sabado a noite ainda e a semana que comecou no domingo anterior', () => {
    // Sabado 22/08/2026 as 23:59. Em UTC ja e domingo — a semana nao pode virar.
    expect(weekRange(new Date(2026, 7, 22, 23, 59))).toEqual({
      start: '2026-08-16',
      end: '2026-08-22',
    });
  });

  it('atravessa virada de mes', () => {
    // Quarta 30/09/2026.
    expect(weekRange(new Date(2026, 8, 30))).toEqual({ start: '2026-09-27', end: '2026-10-03' });
  });

  it('atravessa virada de ano', () => {
    // Quinta 31/12/2026.
    expect(weekRange(new Date(2026, 11, 31))).toEqual({ start: '2026-12-27', end: '2027-01-02' });
  });

  // O ranking e o grafico de volume tem que concordar sobre onde a semana
  // quebra, senao "esta semana" seriam dias diferentes nas duas abas.
  it('comeca sempre na mesma chave de weekStartKey', () => {
    for (let day = 1; day <= 14; day += 1) {
      const date = new Date(2026, 8, day, 12);
      expect(weekRange(date).start).toBe(weekStartKey(date));
    }
  });
});

describe('lastWeekKeys', () => {
  it('devolve n chaves, da mais antiga ate a semana atual', () => {
    // Quarta 30/09/2026: a semana atual comeca no domingo 27/09.
    expect(lastWeekKeys(new Date(2026, 8, 30), 3)).toEqual([
      '2026-09-13',
      '2026-09-20',
      '2026-09-27',
    ]);
  });

  it('atravessa virada de ano', () => {
    // Sabado 02/01/2027: semana de 27/12/2026.
    expect(lastWeekKeys(new Date(2027, 0, 2), 2)).toEqual(['2026-12-20', '2026-12-27']);
  });

  it('com n = 1 e so a semana atual', () => {
    expect(lastWeekKeys(new Date(2026, 8, 30), 1)).toEqual(['2026-09-27']);
  });

  // Os cards de amigos e o grafico de volume tem que falar das mesmas semanas.
  it('bate com as semanas do volumeByWeek', () => {
    const now = new Date(2026, 8, 30, 12);
    expect(lastWeekKeys(now, 12)).toEqual(
      volumeByWeek(new Map(), now, 12).map((week) => week.weekStart),
    );
  });
});

describe('monthRange', () => {
  it.each([
    ['mes de 30 dias', new Date(2026, 8, 15), '2026-09-01', '2026-09-30'],
    ['mes de 31 dias', new Date(2026, 9, 31, 23, 59), '2026-10-01', '2026-10-31'],
    ['fevereiro comum', new Date(2027, 1, 1), '2027-02-01', '2027-02-28'],
    ['fevereiro bissexto', new Date(2028, 1, 29), '2028-02-01', '2028-02-29'],
    ['dezembro', new Date(2026, 11, 31), '2026-12-01', '2026-12-31'],
  ])('%s', (_caso, now, start, end) => {
    expect(monthRange(now)).toEqual({ start, end });
  });
});

describe('weekRangeLabel', () => {
  it('mostra um mes so quando a semana nao cruza', () => {
    expect(weekRangeLabel('2026-08-16')).toBe('16 – 22 ago');
  });

  it('mostra os dois meses quando cruza', () => {
    expect(weekRangeLabel('2026-08-30')).toBe('30 ago – 5 set');
  });

  it('mostra os dois meses na virada de ano', () => {
    expect(weekRangeLabel('2026-12-27')).toBe('27 dez – 2 jan');
  });
});

describe('weekPlan', () => {
  const routines = [
    makeRoutine({ weekday: 1, name: 'Costas + biceps' }),
    makeRoutine({ weekday: 5, name: 'Peito + triceps' }),
  ];

  it('devolve sempre 7 posicoes, domingo primeiro', () => {
    const plan = weekPlan(routines);
    expect(plan).toHaveLength(7);
    expect(plan[0]).toBeNull();
    expect(plan[1]?.name).toBe('Costas + biceps');
    expect(plan[5]?.name).toBe('Peito + triceps');
  });

  it('devolve null nos dias sem rotina — o dia existe mesmo vazio', () => {
    const plan = weekPlan(routines);
    expect(plan.filter((day) => day === null)).toHaveLength(5);
  });

  it('sem rotina nenhuma ainda devolve os 7 dias', () => {
    expect(weekPlan([])).toEqual([null, null, null, null, null, null, null]);
  });

  it('ignora rotina apagada', () => {
    const plan = weekPlan([
      makeRoutine({ weekday: 1, deletedAt: '2026-08-20T10:00:00.000Z' }),
    ]);
    expect(plan[1]).toBeNull();
  });
});

describe('weeksBetween', () => {
  it('mesma semana da zero', () => {
    expect(weeksBetween('2026-08-16', '2026-08-16')).toBe(0);
  });

  it('conta para frente e para tras', () => {
    expect(weeksBetween('2026-08-16', '2026-08-23')).toBe(1);
    expect(weeksBetween('2026-08-16', '2026-08-09')).toBe(-1);
    expect(weeksBetween('2026-08-16', '2026-09-06')).toBe(3);
  });

  it('atravessa o horario de verao sem errar a semana', () => {
    // Se a conta fosse em milissegundos, a hora a mais ou a menos na virada
    // arredondaria para a semana errada.
    expect(weeksBetween('2026-10-11', '2026-10-18')).toBe(1);
    expect(weeksBetween('2027-02-14', '2027-02-21')).toBe(1);
  });
});

describe('weekdayName', () => {
  it('e singular, diferente do rotulo recorrente', () => {
    expect(weekdayName(1)).toBe('Segunda');
    expect(weekdayLabel(1)).toBe('Segundas');
  });

  it('cobre os sete dias comecando no domingo', () => {
    const names = [0, 1, 2, 3, 4, 5, 6].map((d) => weekdayName(d as Weekday));
    expect(names).toEqual([
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ]);
  });
});

describe('everyWeekday / lastWeekday', () => {
  it('concorda em genero com o dia', () => {
    expect(everyWeekday(1)).toBe('toda segunda');
    expect(everyWeekday(6)).toBe('todo sábado');
    expect(everyWeekday(0)).toBe('todo domingo');
    expect(lastWeekday(5)).toBe('sexta passada');
    expect(lastWeekday(0)).toBe('domingo passado');
  });
});

import type { Routine, Weekday } from './types';

/**
 * Datas do app sao sempre datas LOCAIS no formato YYYY-MM-DD.
 *
 * Nunca usar `toISOString().slice(0, 10)` para isso: ele converte para UTC e,
 * no fuso do Brasil (UTC-3), joga qualquer treino antes das 21h para o dia
 * seguinte. `toDateKey` monta a chave a partir dos getters locais.
 */

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Converte YYYY-MM-DD de volta para um Date local a meia-noite. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday;
}

/**
 * O domingo da semana de `date`, como YYYY-MM-DD. E a chave de uma semana.
 *
 * A semana comeca no domingo por coerencia com o resto do app: `Weekday` ja usa
 * 0 = domingo e a grade do calendario (`monthGrid`) ja abre no domingo. Fazer o
 * seletor de semana comecar na segunda deixaria as duas telas discordando sobre
 * onde a semana quebra.
 *
 * Para mudar para segunda-primeiro, trocar SO a linha do `offset` abaixo por
 * `(date.getDay() + 6) % 7`.
 */
export function weekStartKey(date: Date): string {
  const offset = date.getDay();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
  return toDateKey(start);
}

/**
 * Quantas semanas separam duas chaves de semana. 0 = a mesma, -1 = a anterior.
 *
 * Divide por dias inteiros em vez de milissegundos porque o horario de verao
 * muda a diferenca em uma hora e o arredondamento erraria a semana na virada.
 */
export function weeksBetween(from: string, to: string): number {
  const start = fromDateKey(from);
  const end = fromDateKey(to);
  const dayInMs = 24 * 60 * 60 * 1000;
  const days = Math.round((end.getTime() - start.getTime()) / dayInMs);
  return Math.round(days / 7);
}

/** Anda `count` semanas a partir de uma chave de semana. Aceita negativo. */
export function addWeeks(weekStart: string, count: number): string {
  const date = fromDateKey(weekStart);
  date.setDate(date.getDate() + count * 7);
  return toDateKey(date);
}

/**
 * "23 – 29 ago" para o cabecalho do seletor de semana. Quando a semana cruza
 * dois meses, os dois aparecem: "30 ago – 5 set".
 */
export function weekRangeLabel(weekStart: string): string {
  const start = fromDateKey(weekStart);
  const end = fromDateKey(addWeeks(weekStart, 1));
  end.setDate(end.getDate() - 1);

  const startMonth = monthLabelShort(start.getMonth()).toLowerCase();
  const endMonth = monthLabelShort(end.getMonth()).toLowerCase();

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${endMonth}`;
  }
  return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
}

/**
 * Os 7 dias da semana, domingo primeiro, com a rotina de cada um ou null.
 *
 * Os dias nao existem como linha no banco — sao sintetizados aqui na leitura.
 * Fazer backfill de 7 rotinas vazias faria elas subirem para o Supabase e
 * reaparecerem em todo dispositivo, inclusive dias que o usuario nunca vai
 * usar, e ainda quebraria a guarda do `isFirstRun` (onboarding), que considera
 * o app configurado quando ja existe qualquer rotina.
 */
export function weekPlan(routines: readonly Routine[]): (Routine | null)[] {
  const days: (Routine | null)[] = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    days.push(routineForWeekday(routines, weekday as Weekday));
  }
  return days;
}

const WEEKDAY_LABELS = [
  'Domingos',
  'Segundas',
  'Terças',
  'Quartas',
  'Quintas',
  'Sextas',
  'Sábados',
] as const;

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

/** "Sextas" — o rotulo recorrente do plano, como no mockup. */
export function weekdayLabel(weekday: Weekday): string {
  return WEEKDAY_LABELS[weekday];
}

/**
 * "Sexta" — o nome de UM dia, para titular a tela do dia e as linhas de
 * Ajustes. Existe separado de `weekdayLabel` porque o plural ali carrega o
 * sentido recorrente ("toda sexta"), que nao serve para nomear um dia so.
 */
export function weekdayName(weekday: Weekday): string {
  return WEEKDAY_NAMES[weekday];
}

/**
 * Sabado e domingo sao masculinos; os outros cinco, femininos. E o que separa
 * "toda segunda" de "todo sabado" — errar isso numa pergunta de confirmacao le
 * como app traduzido por maquina.
 */
function isMasculine(weekday: Weekday): boolean {
  return weekday === 0 || weekday === 6;
}

/** "toda segunda", "todo sábado" — o alcance de uma mudanca no plano. */
export function everyWeekday(weekday: Weekday): string {
  return `${isMasculine(weekday) ? 'todo' : 'toda'} ${weekdayName(weekday).toLowerCase()}`;
}

/** "segunda passada", "sábado passado" — a base da comparacao do resultado. */
export function lastWeekday(weekday: Weekday): string {
  return `${weekdayName(weekday).toLowerCase()} ${isMasculine(weekday) ? 'passado' : 'passada'}`;
}

/** Iniciais para o cabecalho do calendario, comecando no domingo. */
export function weekdayInitials(): readonly string[] {
  return WEEKDAY_SHORT;
}

/** A rotina planejada para um dia da semana, ou null se for dia de descanso. */
export function routineForWeekday(
  routines: readonly Routine[],
  weekday: Weekday,
): Routine | null {
  const matches = routines
    .filter((routine) => routine.deletedAt === null && routine.weekday === weekday)
    .sort((a, b) => a.position - b.position);
  return matches[0] ?? null;
}

/**
 * A proxima rotina a partir de uma data, olhando os proximos 7 dias.
 * Retorna tambem quantos dias faltam, para o card "Proximo" da home.
 */
export function nextRoutine(
  routines: readonly Routine[],
  from: Date,
): { routine: Routine; daysAhead: number } | null {
  for (let daysAhead = 1; daysAhead <= 7; daysAhead += 1) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + daysAhead);
    const routine = routineForWeekday(routines, weekdayOf(candidate));
    if (routine) return { routine, daysAhead };
  }
  return null;
}

/** Chaves de data dos ultimos `days` dias, terminando em `end` (inclusive). */
export function lastNDays(end: Date, days: number): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(date.getDate() - offset);
    keys.push(toDateKey(date));
  }
  return keys;
}

/** Grade do mes para o calendario: semanas de 7 posicoes, domingo primeiro. */
/**
 * Quantos dias, contando `end`, vao de `end` ate o dia 1 do mes `months` meses
 * atras.
 *
 * Serve ao dot-matrix da home: uma janela fixa de 91 dias cai no meio de um mes
 * e rende quatro blocos, o mais antigo deles um toco de poucos dias. Ancorando
 * no primeiro dia do mes, "tres meses" sao tres blocos de verdade.
 */
export function daysSinceMonthStart(end: Date, months: number): number {
  const start = new Date(end.getFullYear(), end.getMonth() - months, 1);
  const dayInMs = 24 * 60 * 60 * 1000;
  // Normaliza para meia-noite local nos dois lados: sem isso o horario de
  // verao muda a diferenca em uma hora e o arredondamento erra um dia.
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((to - from) / dayInMs) + 1;
}

export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = first.getDay();

  const cells: (string | null)[] = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export function monthLabel(month: number): string {
  return MONTH_LABELS[month];
}

export function monthLabelShort(month: number): string {
  return MONTH_LABELS[month].slice(0, 3);
}

import { renderHook } from '@testing-library/react-native';

import { COMMIT_DELAY } from '../TargetsEditor';
import { useWriteBehind } from '../useWriteBehind';

/**
 * A escrita das series do treino. O que importa e o que chega ao banco: quantas
 * escritas, em que ordem, com qual valor. Cada escrita fica "em voo" ate o
 * teste devolve-la (`land`), como uma transacao do SQLite demorando.
 */

let written: number[];
let landings: (() => void)[];

function perform(value: number): Promise<void> {
  written.push(value);
  return new Promise((resolve) => landings.push(resolve));
}

/** A escrita mais antiga em voo volta do banco. */
async function land() {
  landings.shift()?.();
  await jest.advanceTimersByTimeAsync(0);
}

async function setup() {
  const { result } = await renderHook(() => useWriteBehind(perform));
  return result.current;
}

beforeEach(() => {
  jest.useFakeTimers();
  written = [];
  landings = [];
});

afterEach(() => {
  jest.useRealTimers();
});

it('toques seguidos viram uma escrita so, a do ultimo', async () => {
  const { schedule } = await setup();

  schedule(1);
  schedule(2);
  schedule(3);
  await jest.advanceTimersByTimeAsync(COMMIT_DELAY);

  expect(written).toEqual([3]);
});

it('uma escrita em voo por vez: a seguinte espera a anterior voltar', async () => {
  const { schedule } = await setup();

  schedule(1);
  await jest.advanceTimersByTimeAsync(COMMIT_DELAY);
  schedule(2);
  await jest.advanceTimersByTimeAsync(COMMIT_DELAY);
  expect(written).toEqual([1]);

  await land();
  expect(written).toEqual([1, 2]);
});

it('settle so resolve quando nada sobra na fila nem em voo', async () => {
  const { schedule, settle } = await setup();
  let settled = false;

  schedule(1);
  void settle().then(() => {
    settled = true;
  });
  await jest.advanceTimersByTimeAsync(0);
  expect(written).toEqual([1]);
  expect(settled).toBe(false);

  await land();
  expect(settled).toBe(true);
});

describe('amend', () => {
  it('sem escrita pendente nem em voo, nao grava nada', async () => {
    const { amend } = await setup();

    amend(1);
    await jest.advanceTimersByTimeAsync(COMMIT_DELAY);

    expect(written).toEqual([]);
  });

  it('com uma escrita pendente, toma o lugar dela', async () => {
    const { schedule, amend } = await setup();

    schedule(1);
    amend(2);
    await jest.advanceTimersByTimeAsync(COMMIT_DELAY);

    expect(written).toEqual([2]);
  });

  // O caso das series: marcar grava o exercicio inteiro, e um ajuste de peso
  // feito antes de essa escrita voltar precisa chegar ao banco tambem.
  it('com uma escrita em voo, grava o valor novo logo depois dela', async () => {
    const { schedule, amend } = await setup();

    schedule(1);
    await jest.advanceTimersByTimeAsync(COMMIT_DELAY);
    amend(2);
    await jest.advanceTimersByTimeAsync(COMMIT_DELAY);
    expect(written).toEqual([1]);

    await land();
    expect(written).toEqual([1, 2]);

    await land();
    amend(3);
    await jest.advanceTimersByTimeAsync(COMMIT_DELAY);
    expect(written).toEqual([1, 2]);
  });
});

import { render, screen } from '@testing-library/react-native';

import { MiniBars } from '../MiniBars';

/**
 * O que importa aqui e a escala: as fileiras de pessoas diferentes sao lidas
 * uma contra a outra, entao a mesma quantidade de dias tem que dar a mesma
 * altura em qualquer fileira.
 */

async function setup(values: number[], max = 7) {
  await render(
    <MiniBars values={values} max={max} width={240} height={28} color="#fff" accessibilityLabel="barras" />,
  );
  return screen.queryAllByTestId('mini-bar');
}

const altura = (bar: ReturnType<typeof screen.getByTestId>) => Number(bar.props.height);

describe('MiniBars', () => {
  it('desenha uma barra por valor maior que zero', async () => {
    const bars = await setup([1, 0, 3, 0, 5]);
    expect(bars).toHaveLength(3);
  });

  it('o maximo ocupa a altura toda', async () => {
    const [bar] = await setup([7]);
    expect(altura(bar)).toBeCloseTo(28);
  });

  // Mesma escala para todo mundo: 2 dias e sempre 2/7 da altura, nao importa
  // quem mais esta na fileira.
  it('usa a escala fixa, nao o maior valor da propria fileira', async () => {
    const [bar] = await setup([2]);
    expect(altura(bar)).toBeCloseTo((28 * 2) / 7);
  });

  it('valor acima do maximo nao passa da altura', async () => {
    const [bar] = await setup([9]);
    expect(altura(bar)).toBeCloseTo(28);
  });

  it('as barras nao se encostam: sobra respiro entre elas', async () => {
    const bars = await setup([1, 1]);
    const [first, second] = bars.map((bar) => ({
      x: Number(bar.props.x),
      width: Number(bar.props.width),
    }));
    expect(second.x - (first.x + first.width)).toBeGreaterThanOrEqual(2);
  });
});

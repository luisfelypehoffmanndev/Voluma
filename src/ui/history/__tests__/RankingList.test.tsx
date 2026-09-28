import { render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import type { RankingRow } from '@/domain/friends';

import { RankingList } from '../RankingList';

/**
 * Segundo teste de render do projeto, pelo mesmo motivo do `ProfileForm`: a
 * regra de privacidade ("nao compartilha" nao e zero) so existe no encontro do
 * dominio com a tela. O `rankByValue` guarda o nulo; e aqui que ele poderia
 * virar um "0 dias" sem ninguem notar.
 */

const eu: RankingRow = { handle: 'luis', value: 3, isSelf: true };
const amigo = (handle: string, value: number | null): RankingRow => ({
  handle,
  value,
  isSelf: false,
});

const dias = (value: number) => (value === 1 ? '1 dia' : `${value} dias`);

async function setup(overrides: Partial<ComponentProps<typeof RankingList>> = {}) {
  await render(
    <RankingList
      title="Esta semana"
      rows={[eu, amigo('ana', 2)]}
      max={7}
      format={dias}
      width={320}
      {...overrides}
    />,
  );
}

describe('RankingList', () => {
  it('mostra quem nao compartilha como "não compartilha", nunca como zero', async () => {
    await setup({ rows: [eu, amigo('ana', null)] });

    expect(screen.getByText('não compartilha')).toBeTruthy();
    expect(screen.queryByText('0 dias')).toBeNull();
    expect(screen.getByLabelText('@ana, 2º lugar, não compartilha')).toBeTruthy();
  });

  it('mostra zero como zero quando a pessoa compartilha', async () => {
    await setup({ rows: [eu, amigo('ana', 0)] });

    expect(screen.getByText('0 dias')).toBeTruthy();
    expect(screen.queryByText('não compartilha')).toBeNull();
  });

  it('desenha as linhas na ordem recebida, com a posicao', async () => {
    await setup({ rows: [amigo('ana', 5), eu, amigo('bia', 1)] });

    const linhas = screen.getAllByLabelText(/lugar/).map((linha) => linha.props.accessibilityLabel);
    expect(linhas).toEqual([
      '@ana, 1º lugar, 5 dias',
      'Você, @luis, 2º lugar, 3 dias',
      '@bia, 3º lugar, 1 dia',
    ]);
  });

  // "1º" em fonte mono le "1 º": a posicao e so o numero.
  it('mostra a posicao so com o numero', async () => {
    await setup({ rows: [amigo('ana', 5), eu] });

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText(/º/)).toBeNull();
  });

  it('identifica a sua linha como "Você"', async () => {
    await setup();

    expect(screen.getByText('Você')).toBeTruthy();
    expect(screen.queryByText('@luis')).toBeNull();
    expect(screen.getByText('@ana')).toBeTruthy();
  });

  it('usa o formato recebido, como km', async () => {
    await setup({
      rows: [amigo('ana', 12.4), { ...eu, value: 0 }],
      max: 12.4,
      format: (km) => `${String(km).replace('.', ',')} km`,
    });

    expect(screen.getByText('12,4 km')).toBeTruthy();
    expect(screen.getByLabelText('@ana, 1º lugar, 12,4 km')).toBeTruthy();
  });

  it('mostra o rodape so quando recebe um', async () => {
    await setup({ footer: 'Seus amigos não veem a sua semana.' });
    expect(screen.getByText('Seus amigos não veem a sua semana.')).toBeTruthy();

    await setup();
    expect(screen.queryByText('Seus amigos não veem a sua semana.')).toBeNull();
  });
});

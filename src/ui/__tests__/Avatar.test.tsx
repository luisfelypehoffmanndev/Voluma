import { render, screen } from '@testing-library/react-native';

import { Avatar } from '../Avatar';

/**
 * A foto e identidade: o que importa e que sempre haja ALGO no lugar dela (a
 * inicial, quando nao ha foto ou a URL nao veio) e que o leitor de tela diga
 * de quem e.
 */

describe('Avatar', () => {
  it('mostra a foto quando ha URL', async () => {
    await render(<Avatar handle="ana" uri="https://x/ana.jpg" color="#29B6FF" size={20} />);

    expect(screen.getByTestId('avatar-photo')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
  });

  it('sem foto mostra a inicial do @, em maiuscula', async () => {
    await render(<Avatar handle="ana" uri={null} color="#29B6FF" size={20} />);

    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByTestId('avatar-photo')).toBeNull();
  });

  it('@ que comeca com numero ou ponto usa o primeiro caractere que houver', async () => {
    await render(<Avatar handle="9ana" uri={null} color="#29B6FF" size={20} />);
    expect(screen.getByText('9')).toBeTruthy();
  });

  it('diz de quem e a foto para o leitor de tela', async () => {
    await render(<Avatar handle="ana" uri={null} color="#29B6FF" size={20} />);
    expect(screen.getByLabelText('Foto de @ana')).toBeTruthy();
  });
});

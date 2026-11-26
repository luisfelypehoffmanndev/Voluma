import { colors, people } from '../tokens';

/**
 * Trava a paleta que passou no `validate_palette.js` da skill `dataviz`.
 *
 * Nao testa daltonismo aqui — isso e o validador, rodado a mao. Este teste so
 * garante que ninguem troca um hex sem passar por ele de novo: mudou a cor,
 * quebra aqui, e o comentario de `people` diz o que rodar.
 */
describe('people', () => {
  it('voce e sempre a cor principal (primary)', () => {
    expect(people.self).toBe(colors.accent);
  });

  it('os amigos usam a paleta validada, nesta ordem', () => {
    expect(people.friends).toEqual(['#7c93b3', '#b37c96', '#9aa86f', '#8f84b8', '#6fa89a']);
  });

  it('nenhum amigo tem a cor de voce', () => {
    expect(people.friends).not.toContain(people.self);
  });
});

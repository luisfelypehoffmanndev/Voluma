import { colors, people } from '../tokens';

/**
 * Trava a paleta que passou no `validate_palette.js` da skill `dataviz`.
 *
 * Nao testa daltonismo aqui — isso e o validador, rodado a mao. Este teste so
 * garante que ninguem troca um hex sem passar por ele de novo: mudou a cor,
 * quebra aqui, e o comentario de `people` diz o que rodar.
 */
describe('people', () => {
  it('voce e sempre o laranja da marca', () => {
    expect(people.self).toBe(colors.accent);
  });

  it('os amigos usam a paleta validada, nesta ordem', () => {
    expect(people.friends).toEqual(['#29B6FF', '#FF4FC0', '#C6F53D', '#6E6BFF', '#3DF2C4']);
  });

  it('nenhum amigo tem a cor do laranja', () => {
    expect(people.friends).not.toContain(people.self);
  });
});

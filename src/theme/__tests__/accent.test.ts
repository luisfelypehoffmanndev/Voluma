/**
 * O accent sai da config do build (e do OTA). Uma config sem accent, ou com um
 * valor que nao e cor, nao pode deixar o app sem a cor de destaque: vale o
 * laranja da marca.
 */

type Tokens = typeof import('../tokens');

function tokensWith(extra: unknown): Tokens {
  let tokens: Tokens | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra } } }));
    tokens = jest.requireActual<Tokens>('../tokens');
  });
  return tokens!;
}

afterEach(() => jest.dontMock('expo-constants'));

it('usa o accent da academia, e deriva dele o degrade dos graficos', () => {
  const { colors, chart, people } = tokensWith({ theme: { accent: '#29b6ff' } });

  expect(colors.accent).toBe('#29B6FF');
  expect(people.self).toBe('#29B6FF');
  expect(chart.area).toBe('rgba(41,182,255,0.24)');
  expect(chart.fade).toBe('rgba(41,182,255,0)');
});

it.each([
  ['sem extra', undefined],
  ['sem tema', {}],
  ['accent que nao e cor', { theme: { accent: 'laranja' } }],
  ['hex curto', { theme: { accent: '#F50' } }],
])('%s: fica o laranja da marca', (_caso, extra) => {
  const { colors, chart } = tokensWith(extra);

  expect(colors.accent).toBe('#FF5C00');
  expect(chart.area).toBe('rgba(255,92,0,0.24)');
});

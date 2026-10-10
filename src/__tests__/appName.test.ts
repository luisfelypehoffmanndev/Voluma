/**
 * O nome que os textos do app usam ("Voluma", ou o da academia) sai da config
 * de cada variante. Sem nome valido na config, fica "Voluma".
 */

type World = typeof import('../world');

function worldWith(expoConfig: unknown): World {
  let world: World | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig } }));
    world = jest.requireActual<World>('../world');
  });
  return world!;
}

afterEach(() => jest.dontMock('expo-constants'));

it('usa o nome da academia', () => {
  expect(worldWith({ name: 'Voluma Teste' }).APP_NAME).toBe('Voluma Teste');
});

it.each([
  ['sem config', undefined],
  ['sem nome', {}],
  ['nome vazio', { name: '   ' }],
])('%s: fica Voluma', (_caso, expoConfig) => {
  expect(worldWith(expoConfig).APP_NAME).toBe('Voluma');
});

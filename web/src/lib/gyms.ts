/**
 * Nome e cor de cada academia, da mesma pasta `gyms/<slug>/config.json` que
 * monta o app dela. O painel nao le a tabela `gyms` (o RLS dela nao libera
 * ninguem): a marca vem do repositorio, como no build.
 */
type GymConfig = { name: string; accent: string };

const configs = import.meta.glob<GymConfig>('../../../gyms/*/config.json', {
  eager: true,
  import: 'default',
});

const bySlug = new Map(
  Object.entries(configs).map(([path, config]) => [path.split('/').at(-2) ?? '', config]),
);

const FALLBACK: GymConfig = { name: 'Academia', accent: '#FF5C00' };

export function gymConfig(slug: string): GymConfig {
  return bySlug.get(slug) ?? { ...FALLBACK, name: slug };
}

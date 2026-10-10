import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

import appConfig from '../../../app.config';
import appJson from '../../../app.json';
import { gymFromPackage, schemeFor } from '../../world';
import { contrastRatio, HEX_COLOR } from '../color';
import { colors } from '../tokens';

/**
 * Toda pasta em gyms/ vira um app na loja. Este teste e o que pega, antes do
 * build, uma academia que nao sairia: slug invalido, arquivo faltando, cor sem
 * contraste, ou uma config que o app leria como outro mundo.
 */

const GYMS_DIR = path.join(__dirname, '../../../gyms');
const ASSETS = ['icon.png', 'splash-icon.png', 'android-icon-foreground.png', 'android-icon-monochrome.png'];

const slugs = fs
  .readdirSync(GYMS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function configFor(slug: string): ExpoConfig {
  const previous = process.env.APP_VARIANT;
  process.env.APP_VARIANT = slug;
  try {
    return appConfig({ config: appJson.expo } as unknown as ConfigContext);
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

it('existe o mundo padrao', () => {
  expect(slugs).toContain('padrao');
});

describe.each(slugs)('gyms/%s', (slug) => {
  const gym = JSON.parse(fs.readFileSync(path.join(GYMS_DIR, slug, 'config.json'), 'utf8'));

  it('tem um slug que cabe no package, no scheme e no banco (v12)', () => {
    expect(slug).toMatch(/^[a-z][a-z0-9]{1,29}$/);
  });

  it('tem nome e accent em hex', () => {
    expect(typeof gym.name).toBe('string');
    expect(gym.name.trim().length).toBeGreaterThan(0);
    expect(gym.accent).toMatch(HEX_COLOR);
  });

  // Texto preto em cima do accent (textOnAccent) e o accent sobre o fundo.
  it('tem accent com contraste de pelo menos 4,5:1', () => {
    expect(contrastRatio(gym.accent, colors.textOnAccent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(gym.accent, colors.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ASSETS)('tem %s', (file) => {
    expect(fs.existsSync(path.join(GYMS_DIR, slug, file))).toBe(true);
  });

  // O build e o app precisam concordar: o package que o build grava e o que o
  // app le para saber o proprio mundo.
  it('gera um build que o app le como o mundo certo', () => {
    const config = configFor(slug);

    expect(gymFromPackage(config.android?.package)).toBe(slug);
    expect(config.ios?.bundleIdentifier).toBe(config.android?.package);
    expect(config.scheme).toBe(schemeFor(slug));
    expect(config.extra?.gymId).toBe(slug);
    expect(config.extra?.theme).toEqual({ accent: gym.accent });
  });
});

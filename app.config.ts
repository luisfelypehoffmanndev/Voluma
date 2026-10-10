import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// O app.json descreve o app padrao inteiro (e e o que o eas init e o update:configure
// editam); aqui so se troca o que muda por academia. Ver plans/16-multi-academia.md.

const DEFAULT_GYM = 'padrao';
const BASE_ID = 'com.luisf.voluma';
// A regra da v12: o slug vira package Android, scheme e bundle iOS sem traducao.
const SLUG = /^[a-z][a-z0-9]{1,29}$/;

type Gym = { name: string; accent: string };

function loadGym(slug: string): Gym {
  if (!SLUG.test(slug)) {
    throw new Error(`APP_VARIANT="${slug}": so letras minusculas e numeros, comecando por letra.`);
  }
  const file = path.join(__dirname, 'gyms', slug, 'config.json');
  if (!fs.existsSync(file)) throw new Error(`APP_VARIANT="${slug}": falta gyms/${slug}/config.json.`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Gym;
}

type Plugin = NonNullable<ExpoConfig['plugins']>[number];

export default ({ config }: ConfigContext): ExpoConfig => {
  const slug = process.env.APP_VARIANT || DEFAULT_GYM;
  const gym = loadGym(slug);
  const isDefault = slug === DEFAULT_GYM;
  const id = isDefault ? BASE_ID : `${BASE_ID}.${slug}`;
  const asset = (file: string) => `./gyms/${slug}/${file}`;

  const withGym = (plugin: Plugin): Plugin => {
    if (!Array.isArray(plugin)) return plugin;
    const [name, options] = plugin as [string, Record<string, unknown>];
    if (name === 'expo-splash-screen') return [name, { ...options, image: asset('splash-icon.png') }];
    if (name === 'expo-image-picker') {
      return [
        name,
        {
          ...options,
          photosPermission: `O ${gym.name} usa uma foto da sua galeria como foto de perfil, que só seus amigos veem.`,
        },
      ];
    }
    return plugin;
  };

  return {
    ...config,
    name: gym.name,
    slug: config.slug ?? 'voluma',
    scheme: isDefault ? 'voluma' : `voluma-${slug}`,
    icon: asset('icon.png'),
    ios: { ...config.ios, bundleIdentifier: id },
    android: {
      ...config.android,
      package: id,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: asset('android-icon-foreground.png'),
        monochromeImage: asset('android-icon-monochrome.png'),
      },
    },
    plugins: config.plugins?.map(withGym),
    extra: { ...config.extra, gymId: slug, theme: { accent: gym.accent } },
  };
};

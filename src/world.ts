import * as Application from 'expo-application';
import Constants from 'expo-constants';

export const DEFAULT_GYM = 'padrao';

const BASE_PACKAGE = 'com.luisf.voluma';

/** Package nativo → mundo. Sem package (testes, Expo Go) ou de outro app, o mundo padrao. */
export function gymFromPackage(applicationId: string | null | undefined): string {
  const prefix = `${BASE_PACKAGE}.`;
  if (applicationId?.startsWith(prefix)) return applicationId.slice(prefix.length);
  return DEFAULT_GYM;
}

/** O padrao fica em `voluma`, que e o redirect ja liberado no Supabase. */
export function schemeFor(gym: string): string {
  return gym === DEFAULT_GYM ? 'voluma' : `voluma-${gym}`;
}

// Do package, e nao da config: o package e nativo, e um OTA publicado errado nao o altera.
export const GYM = gymFromPackage(Application.applicationId);

const declared: unknown = Constants.expoConfig?.extra?.gymId;
if (typeof declared === 'string' && declared !== GYM) {
  console.warn(`Config da academia "${declared}" no app de "${GYM}": vale o package.`);
}

import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';

// Imports por subcaminho, nao pelo indice do pacote: o indice reexporta todos
// os pesos e o bundler acaba embarcando ~2 MB de TTF que o app nunca usa.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { JetBrainsMono_300Light } from '@expo-google-fonts/jetbrains-mono/300Light';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useOnboarding } from '@/store/onboarding';
import { usePrefs } from '@/store/prefs';
import { useSyncLifecycle } from '@/sync/auth';
import { colors } from '@/theme/tokens';
import { BlurTargetProvider } from '@/ui/blurTarget';

// O splash fica ate as fontes carregarem: sem elas o app pisca em Helvetica e
// os numeros grandes reflowam, o que estraga justamente o "ar de instrumento".
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ja escondido em fast refresh — nao e erro */
});

export default function RootLayout() {
  const [ready] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    JetBrainsMono_300Light,
    JetBrainsMono_400Regular,
  });

  useSyncLifecycle();

  // Le a preferencia de vibracao uma vez, na raiz. Ate o disco responder o
  // padrao vale, entao nada aqui bloqueia a montagem.
  useEffect(() => {
    void usePrefs.getState().load();
  }, []);

  // Primeira abertura ou nao — decidido antes de qualquer tela aparecer, para a
  // home nao piscar vazia e so depois ceder lugar ao onboarding.
  const onboarding = useOnboarding((state) => state.status);
  useEffect(() => {
    void useOnboarding.getState().check();
  }, []);

  const booted = ready && onboarding !== 'checking';

  useEffect(() => {
    if (booted) SplashScreen.hideAsync().catch(() => {});
  }, [booted]);

  if (!booted) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/*
          Registra qual tela o vidro deve borrar no Android. Fica na raiz porque
          a tab bar vive fora das telas e precisa alcancar o alvo da que esta em
          foco — ver src/ui/blurTarget.tsx.
        */}
        <BlurTargetProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="session/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="result/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="day/[weekday]" />
            <Stack.Screen name="catalog" />
            <Stack.Screen name="library" />
            <Stack.Screen name="bodyweight" options={{ presentation: 'modal' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="profile-setup" options={{ presentation: 'modal' }} />
          </Stack>
        </BlurTargetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

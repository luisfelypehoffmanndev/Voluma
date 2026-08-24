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

import { useSyncLifecycle } from '@/sync/auth';
import { colors } from '@/theme/tokens';

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

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="routine/[id]" />
          <Stack.Screen name="bodyweight" options={{ presentation: 'modal' }} />
          <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

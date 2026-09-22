import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useProfile } from '@/store/profile';
import { useAuth } from '@/sync/auth';
import { colors, fontSize, radius, spacing, surfaces } from '@/theme/tokens';
import { PressableSurface } from '@/ui/PressableSurface';
import { GoogleIcon } from '@/ui/icons';
import { Header, Screen } from '@/ui/Screen';
import { Body, Meta } from '@/ui/Text';

/**
 * Login com conta Google.
 *
 * A tela nao bloqueia o app: quem nao entra continua usando tudo local. Por
 * isso ela e alcancada pelo Perfil, e nao imposta no boot.
 *
 * Um botao so, sem formulario: nao ha senha propria para digitar.
 */
export default function LoginScreen() {
  const router = useRouter();
  const signInWithGoogle = useAuth((state) => state.signInWithGoogle);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle();

    if (result) {
      setBusy(false);
      setError(result);
      return;
    }

    // `applySession` ja disparou a carga do perfil, mas pode nao ter chegado:
    // sem esperar, quem ja tem @ veria a tela de escolher um por um instante.
    const { userId } = useAuth.getState();
    if (userId) await useProfile.getState().load(userId);
    const hasProfile = useProfile.getState().profile !== null;

    setBusy(false);
    // Troca o modal em vez de empilhar: voltar do perfil tem que cair no
    // Perfil, nao numa tela de login de uma conta em que a pessoa ja entrou.
    if (hasProfile) router.back();
    else router.replace('/profile-setup');
  };

  return (
    <Screen>
      <Header title="Conta" back />

      <View style={styles.body}>
        <View style={styles.intro}>
          <Body>Entrar com o Google</Body>
          <Meta>backup e segundo aparelho, seus treinos continuam no aparelho</Meta>
        </View>

        {/* Erro em texto branco, nao em vermelho: o brief proibe segunda cor. */}
        {error ? <Body style={styles.error}>{error}</Body> : null}

        <PressableSurface
          disabled={busy}
          onPress={submit}
          pressedOpacity={0.8}
          borderRadius={radius.pill}
          style={styles.primary}
        >
          {busy ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <View style={styles.primaryContent}>
              <GoogleIcon size={18} />
              <Body>Continuar com Google</Body>
            </View>
          )}
        </PressableSurface>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  intro: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  error: {
    fontSize: fontSize.body,
  },
  primary: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: surfaces.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

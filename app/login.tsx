import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/sync/auth';
import { colors, fontSize, fonts, radius, spacing, surfaces } from '@/theme/tokens';
import { PressableSurface } from '@/ui/PressableSurface';
import { Header, Screen } from '@/ui/Screen';
import { Body, Label, Meta } from '@/ui/Text';

/**
 * Login por e-mail e senha.
 *
 * A tela nao bloqueia o app: quem nao entra continua usando tudo local. Por
 * isso ela e alcancada pelo Perfil, e nao imposta no boot.
 */
export default function LoginScreen() {
  const router = useRouter();
  const signIn = useAuth((state) => state.signIn);
  const signUp = useAuth((state) => state.signUp);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (mode: 'in' | 'up') => {
    setBusy(true);
    setError(null);
    const result = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);

    if (result) {
      setError(result);
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <Header title="Conta" back />

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.body}
      >
        <View style={styles.field}>
          <Label>E-mail</Label>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="voce@exemplo.com"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Label>Senha</Label>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
        </View>

        {/* Erro em texto branco, nao em vermelho: o brief proibe segunda cor. */}
        {error ? <Body style={styles.error}>{error}</Body> : null}

        <PressableSurface
          disabled={busy}
          onPress={() => submit('in')}
          pressedOpacity={0.8}
          borderRadius={radius.pill}
          style={styles.primary}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Body style={styles.primaryLabel}>Entrar</Body>
          )}
        </PressableSurface>

        <Pressable disabled={busy} onPress={() => submit('up')} style={styles.secondary}>
          <Meta>Criar conta com este e-mail</Meta>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  input: {
    height: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: surfaces.raised,
    borderRadius: radius.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontFamily: fonts.sans,
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  error: {
    fontSize: fontSize.body,
  },
  primary: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryLabel: {
    color: colors.bg,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});

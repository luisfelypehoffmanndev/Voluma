import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { handleCandidates } from '@/domain/handle';
import { useProfile } from '@/store/profile';
import { useAuth } from '@/sync/auth';
import { spacing } from '@/theme/tokens';
import { Header, Screen } from '@/ui/Screen';
import { Body, Meta } from '@/ui/Text';
import { ProfileForm, type ProfileValues } from '@/ui/profile/ProfileForm';

/**
 * Onde a pessoa escolhe o @ depois de entrar pela primeira vez, e onde volta
 * para editar.
 *
 * Tem saida sem preencher de proposito: o app inteiro e construido para nunca
 * barrar o caminho de quem so quer treinar — uma tela obrigatoria entre o login
 * e o treino seria a primeira.
 */
export default function ProfileSetupScreen() {
  const router = useRouter();
  const { userId, email, displayName } = useAuth();
  const { profile, loading, claim, save } = useProfile();

  const [taken, setTaken] = useState(false);

  // Os candidatos so mudam se a conta mudar; recalcular a cada tecla digitada
  // no formulario faria o campo se reescrever sozinho.
  const candidates = useMemo(
    () => handleCandidates(displayName ?? '', email ?? ''),
    [displayName, email],
  );

  const editing = profile !== null;

  const submit = async (values: ProfileValues) => {
    if (!userId) return;
    setTaken(false);

    // So cai para os candidatos gerados quem aceitou a sugestao como estava:
    // ai a colisao se resolve sozinha, em vez de virar erro na cara de quem
    // acabou de entrar. Quem digitou o proprio @ recebe "ja e de outra pessoa"
    // — trocar por outro nome pelas costas gravaria um @ que ninguem escolheu.
    const queue = values.handle === candidates[0] ? candidates : [values.handle];

    const result = editing
      ? await save(values)
      : await claim(userId, queue, {
          age: values.age,
          trainingYears: values.trainingYears,
        });

    if (result === 'handle-taken') {
      setTaken(true);
      return;
    }
    if (result === 'ok') router.back();
  };

  return (
    <Screen>
      <Header title={editing ? 'Seu perfil' : 'Escolha seu @'} back />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Meta>
          {editing
            ? 'o que seus amigos veem · idade e anos de treino são opcionais'
            : 'seus treinos continuam seus · isto é só como amigos te acham'}
        </Meta>

        <ProfileForm
          key={profile?.handle ?? candidates[0]}
          initialHandle={profile?.handle ?? candidates[0]}
          initialAge={profile?.age ?? null}
          initialTrainingYears={profile?.trainingYears ?? null}
          submitLabel={editing ? 'Salvar' : 'Continuar'}
          taken={taken}
          busy={loading}
          onSubmit={(values) => void submit(values)}
        />

        {editing ? null : (
          <Pressable style={styles.skip} onPress={() => router.back()}>
            <Body>Agora não</Body>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});

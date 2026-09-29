import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { useProfile } from '@/store/profile';
import { useAuth } from '@/sync/auth';
import { isCloudConfigured } from '@/sync/supabase';
import { spacing } from '@/theme/tokens';
import { EmptyState } from '@/ui/EmptyState';
import { LoadError } from '@/ui/LoadError';
import { useTabBarClearance } from '@/ui/tabBar';
import { Meta } from '@/ui/Text';

import { FriendsRanking } from './FriendsRanking';
import { useFriendsData } from './useFriendsData';

/**
 * Amigos do historico: o ranking da semana, e o detalhe de cada amigo a um
 * toque.
 *
 * Uma tela so com o ranking, e nao quatro cards repetindo as mesmas pessoas:
 * era o mesmo grupo de gente listado quatro vezes, com um rodape explicando
 * cada lista. O detalhe (12 semanas, meta, corrida) mora na tela do amigo.
 *
 * Nenhum numero compara carga ou volume: so dias treinados, constancia e km.
 */
export function FriendsPanel() {
  const status = useAuth((state) => state.status);

  if (!isCloudConfigured) {
    return <Meta style={styles.local}>Conecte-se para adicionar amigos.</Meta>;
  }
  if (status === 'loading') return null;
  if (status !== 'signedIn') return <SignedOut />;
  return <Friends />;
}

function SignedOut() {
  const router = useRouter();
  return (
    <EmptyState
      title="Acesse sua conta"
      message="O ranking da semana é sincronizado na nuvem."
      action={{ label: 'Entrar', onPress: () => router.push('/login') }}
      style={styles.pad}
    />
  );
}

function Friends() {
  const router = useRouter();
  const clearance = useTabBarClearance();
  const sharesStats = useProfile((state) => state.profile?.sharesStats ?? false);
  const { data, error, reload } = useFriendsData();

  if (error) return <LoadError error={error} onRetry={reload} />;
  if (!data) return null;

  if (data.people.length === 1) {
    return (
      <EmptyState
        title="Nenhum amigo"
        message="Adicione amigos para ver o ranking."
        action={{ label: 'Adicionar amigos', onPress: () => router.push('/friends') }}
        style={styles.pad}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
      showsVerticalScrollIndicator={false}
    >
      <FriendsRanking
        people={data.people}
        selfShares={sharesStats}
        onOpen={(id) => router.push({ pathname: '/friend/[id]', params: { id } })}
        onShare={() => router.push('/profile')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  pad: {
    paddingHorizontal: spacing.xl,
  },
  local: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    textAlign: 'center',
  },
});

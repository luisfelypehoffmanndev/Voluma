import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { listBodyWeightLogs } from '@/db/repo';
import type { Profile } from '@/domain/types';
import { formatWeight } from '@/domain/volume';
import { useQuery } from '@/store/data';
import { useFriends } from '@/store/friends';
import { useProfile } from '@/store/profile';
import { useAuth } from '@/sync/auth';
import { isCloudConfigured } from '@/sync/supabase';
import { colors, spacing } from '@/theme/tokens';
import { usePrefs } from '@/store/prefs';
import { Card } from '@/ui/Card';
import { CheckCell } from '@/ui/CheckCell';
import { preview } from '@/ui/haptics';
import { relativeTime } from '@/ui/relative';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta } from '@/ui/Text';
import { ChevronRightIcon, SyncIcon } from '@/ui/icons';

/**
 * Perfil: o que e seu e nao e treino — peso, preferencias, conta, creditos.
 *
 * Era "Ajustes", e o plano da semana e o catalogo moravam aqui. Sairam para a
 * aba Plano: montar o treino e conteudo, e conteudo escondido atras de um icone
 * de configuracao e conteudo que ninguem acha.
 */
export default function ProfileScreen() {
  const clearance = useTabBarClearance();
  const router = useRouter();

  const { data: weights, error, reload } = useQuery(useCallback(() => listBodyWeightLogs(1), []));
  const latest = weights?.[0] ?? null;

  return (
    <Screen>
      <Header title="Perfil" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* So o peso le o banco nesta tela; vibracao, nuvem e creditos
            continuam funcionando mesmo se a consulta falhar. */}
        {error ? <LoadError error={error} onRetry={reload} /> : null}

        <Card onPress={() => router.push('/bodyweight')}>
          <Label>Peso corporal</Label>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Body>{latest ? `${formatWeight(latest.weightKg)} kg` : 'Registrar peso'}</Body>
              <Meta>{latest ? relativeTime(latest.loggedAt) : 'sem registro ainda'}</Meta>
            </View>
            <ChevronRightIcon size={16} color={colors.textSecondary} />
          </View>
        </Card>

        <Card onPress={() => router.push('/onboarding?replay=1')}>
          <Label>Ajuda</Label>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Body>Como o Voluma funciona</Body>
              <Meta>plano, treino e histórico em duas telas</Meta>
            </View>
            <ChevronRightIcon size={16} color={colors.textSecondary} />
          </View>
        </Card>

        <MotionCard />

        <PublicProfileCard />

        <FriendsCard />

        <SharingCard />

        <SyncCard />

        <CreditsCard />
      </ScrollView>
    </Screen>
  );
}

/**
 * Vibracao ao confirmar.
 *
 * A caixa e a mesma `CheckCell` do registro de treino, e nao um `Switch`: o §7
 * do brief proibe toggle redondo, e o §6 diz que o app tem UMA linguagem para
 * celula marcavel. Um switch de plataforma aqui seria a segunda.
 *
 * O accent repetido nao infringe a regra de "um por tela": esta e a unica caixa
 * desta tela, e nenhum outro elemento daqui usa accent.
 */
function MotionCard() {
  const haptics = usePrefs((state) => state.haptics);
  const setHaptics = usePrefs((state) => state.setHaptics);

  return (
    <Card>
      <Label>Vibração</Label>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Body>Ao confirmar</Body>
          <Meta>um toque ao marcar concluído, nunca ao navegar</Meta>
        </View>
        <CheckCell
          checked={haptics}
          onPress={() => {
            // Vibra ao LIGAR, para o toque ser a propria demonstracao do que
            // acabou de ser ativado. Ao desligar, silencio — vibrar para dizer
            // "nao vou mais vibrar" seria contraditorio.
            if (!haptics) preview();
            setHaptics(!haptics);
          }}
        />
      </View>
    </Card>
  );
}

/**
 * O perfil publico — o @ com que amigos acham a pessoa.
 *
 * So aparece com conta, porque o perfil vive so no Supabase: nao ha o que
 * mostrar a amigos de quem usa o app so neste aparelho.
 *
 * Tambem e a porta de entrada de quem ja estava logado antes desta tela
 * existir: essa pessoa nao passa mais pelo login, entao o card em estado
 * "definir" e o unico caminho ate o @ dela.
 */
function PublicProfileCard() {
  const router = useRouter();
  const status = useAuth((state) => state.status);
  const { profile, loading, error } = useProfile();

  if (status !== 'signedIn') return null;

  return (
    <Card onPress={() => router.push('/profile-setup')}>
      <Label>Perfil</Label>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Body>{profile ? `@${profile.handle}` : 'Escolher seu @'}</Body>
          <Meta>{profileMeta({ profile, loading, error })}</Meta>
        </View>
        <ChevronRightIcon size={16} color={colors.textSecondary} />
      </View>
    </Card>
  );
}

function profileMeta({
  profile,
  loading,
  error,
}: {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}): string {
  if (loading) return 'carregando…';
  // Sem cor de estado: a falha se comunica por texto, como no resto da tela.
  if (error) return `${error}, toque para tentar de novo`;
  if (!profile) return 'é assim que seus amigos vão te achar';

  const traits = [
    profile.age === null ? null : `${profile.age} anos`,
    profile.trainingYears === null ? null : `${profile.trainingYears} de treino`,
  ].filter(Boolean);

  return traits.length > 0 ? traits.join(' · ') : 'idade e anos de treino em branco';
}

/**
 * Amigos: quantos sao, e quantos pedidos esperam resposta.
 *
 * Pedido pendente aparece no subtitulo e nao como sinal colorido — o brief
 * proibe cor de estado, e um numero ja diz o que precisa ser dito.
 */
function FriendsCard() {
  const router = useRouter();
  const status = useAuth((state) => state.status);
  const lists = useFriends((state) => state.lists);

  if (status !== 'signedIn') return null;

  return (
    <Card onPress={() => router.push('/friends')}>
      <Label>Amigos</Label>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Body>{friendsTitle(lists.accepted.length)}</Body>
          <Meta>{friendsMeta(lists.incoming.length)}</Meta>
        </View>
        <ChevronRightIcon size={16} color={colors.textSecondary} />
      </View>
    </Card>
  );
}

function friendsTitle(count: number): string {
  if (count === 0) return 'Adicionar amigos';
  return count === 1 ? '1 amigo' : `${count} amigos`;
}

function friendsMeta(pending: number): string {
  if (pending === 0) return 'pelo @ · com aceite dos dois lados';
  return pending === 1 ? '1 pedido esperando você' : `${pending} pedidos esperando você`;
}

/**
 * O toggle unico de compartilhamento.
 *
 * Um so para tudo — volume, treinos, idade, anos de treino — e desligado por
 * padrao. Permissao por campo multiplicaria a superficie de decisao e a de bug
 * de privacidade, e um padrao que compartilha sem ninguem ter escolhido seria
 * o oposto do resto do app.
 *
 * O @handle NAO entra aqui: e o que permite reconhecer a pessoa, nao um dado
 * de treino.
 *
 * A caixa e a mesma `CheckCell` da vibracao, nao um `Switch` — §7 proibe toggle
 * redondo, e o app tem uma linguagem so para celula marcavel.
 */
function SharingCard() {
  const status = useAuth((state) => state.status);
  const { profile, save } = useProfile();

  if (status !== 'signedIn' || !profile) return null;

  return (
    <Card>
      <Label>Compartilhar</Label>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Body>Com seus amigos</Body>
          <Meta>
            {profile.sharesStats
              ? 'volume, treinos, idade e anos de treino'
              : 'ninguém vê seus números, só o seu @'}
          </Meta>
        </View>
        <CheckCell
          checked={profile.sharesStats}
          onPress={() => void save({ sharesStats: !profile.sharesStats })}
        />
      </View>
    </Card>
  );
}

/**
 * Estado da nuvem, sem alarme visual.
 *
 * O brief proibe cor de estado, entao "pendente" e "sincronizado" se
 * distinguem por texto e por dado — quantas mudancas faltam subir — nao por
 * verde/vermelho.
 */
function SyncCard() {
  const router = useRouter();
  const { status, email, syncing, pending, lastSync, runSync, signOut } = useAuth();

  if (!isCloudConfigured) {
    return (
      <Card>
        <Label>Nuvem</Label>
        <View style={styles.rowText}>
          <Body>Somente local</Body>
          <Meta>preencha o .env para sincronizar</Meta>
        </View>
      </Card>
    );
  }

  if (status !== 'signedIn') {
    return (
      <Card onPress={() => router.push('/login')}>
        <Label>Nuvem</Label>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Body>Entrar</Body>
            <Meta>backup e segundo aparelho</Meta>
          </View>
          <ChevronRightIcon size={16} color={colors.textSecondary} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Label>Nuvem</Label>

      <Pressable style={styles.row} onPress={() => void runSync()} disabled={syncing}>
        <View style={styles.rowText}>
          <Body numberOfLines={1}>{email}</Body>
          <Meta>
            {syncing
              ? 'sincronizando…'
              : pending > 0
                ? `${pending} ${pending === 1 ? 'mudança pendente' : 'mudanças pendentes'}`
                : lastSync?.error
                  ? lastSync.error
                  : 'tudo sincronizado'}
          </Meta>
        </View>
        <SyncIcon size={18} color={colors.textSecondary} />
      </Pressable>

      <Pressable style={styles.row} onPress={() => void signOut()}>
        <View style={styles.rowText}>
          <Body>Sair</Body>
          <Meta>apaga os dados deste aparelho</Meta>
        </View>
      </Pressable>
    </Card>
  );
}

/**
 * Credito da arte dos movimentos.
 *
 * Nao e enfeite: as figuras sao CC BY-SA 4.0, e BY quer dizer que o credito tem
 * que estar visivel para quem usa o app, nao so no repositorio. Fica no fim de
 * Perfil, que e onde credito costuma morar e onde ninguem tropeca nele.
 */
function CreditsCard() {
  return (
    <Card>
      <Label>Créditos</Label>
      <View style={styles.rowText}>
        <Body>Figuras dos exercícios</Body>
        <Meta>Bryl Lim · workout-guide, derivado de Everkinetic · CC BY-SA 4.0</Meta>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
    marginTop: spacing.sm,
  },
});

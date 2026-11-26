import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Text } from 'react-native';

import { listBodyWeightLogs } from '@/db/repo';
import type { Profile } from '@/domain/types';
import { formatWeight } from '@/domain/volume';
import { useQuery } from '@/store/data';
import { FLAG_STAFF_PANEL, STAFF_PANEL_NOTICE, useFlag } from '@/store/flags';
import { useFriends } from '@/store/friends';
import { useProfile } from '@/store/profile';
import { useAuth } from '@/sync/auth';
import { signedAvatarUrls } from '@/sync/avatar';
import { syncStatusText } from '@/sync/status';
import { isCloudConfigured } from '@/sync/supabase';
import { colors, fonts, people, section, spacing, theme } from '@/theme/tokens';
import { usePrefs } from '@/store/prefs';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { pickAvatar } from '@/ui/profile/pickAvatar';
import { CheckCell } from '@/ui/CheckCell';
import { confirm, preview } from '@/ui/haptics';
import { relativeTime } from '@/ui/relative';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta } from '@/ui/Text';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { BodyIcon, ChevronRightIcon, CloudIcon, ImageIcon, InfoIcon, PeopleIcon, PersonIcon, PhoneIcon, ShareIcon, SyncIcon } from '@/ui/icons';

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
  const signedIn = useAuth((state) => state.status === 'signedIn');
  const latest = weights?.[0] ?? null;

  return (
    <Screen>
      <Header title="Perfil" badge={{ icon: <PersonIcon size={26} color="#FFFFFF" filled />, color: section.profile }} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* So o peso le o banco nesta tela; vibracao, nuvem e creditos
            continuam funcionando mesmo se a consulta falhar. */}
        {error ? <LoadError error={error} onRetry={reload} /> : null}

        {/* Tres grupos, com nome. Nove cards seguidos, todos do mesmo
            tamanho e sem titulo, nao diziam onde procurar o que. */}
        <Label style={styles.sectionLabel}>VOCÊ</Label>

        <Card onPress={() => router.push('/bodyweight')}>
          <CardTitle color={section.profile} icon={<BodyIcon size={18} color="#FFFFFF" filled />}>Peso corporal</CardTitle>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Body>{latest ? `${formatWeight(latest.weightKg)} kg` : 'Registrar peso'}</Body>
              <Meta>{latest ? relativeTime(latest.loggedAt) : 'sem registro ainda'}</Meta>
            </View>
            <ChevronRightIcon size={16} color={colors.textSecondary} />
          </View>
        </Card>

        <PublicProfileCard />

        <AvatarCard />

        {/* O rotulo do grupo so aparece com conta: sem login estes quatro cards
            somem, e um titulo sozinho e pior que nenhum. */}
        {signedIn ? <Label style={styles.sectionLabel}>SOCIAL</Label> : null}

        <FriendsCard />

        <SharingCard />

        <Label style={styles.sectionLabel}>APP</Label>


        <MotionCard />

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
      <CardTitle color={section.profile} icon={<PhoneIcon size={18} color="#FFFFFF" filled />}>Vibração</CardTitle>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Body>Feedback tátil</Body>
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

  const meta = profileMeta({ profile, loading, error });

  return (
    <Card onPress={() => router.push('/profile-setup')}>
      <CardTitle color={section.profile} icon={<PersonIcon size={18} color="#FFFFFF" filled />}>Perfil</CardTitle>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Body>{profile ? `@${profile.handle}` : 'Definir @'}</Body>
          {meta ? <Meta>{meta}</Meta> : null}
        </View>
        <ChevronRightIcon size={16} color={colors.textSecondary} />
      </View>
    </Card>
  );
}

/**
 * A foto de perfil: escolher da galeria ou remover.
 *
 * Separada do card do @ porque o @ abre outra tela e a foto nao — tocar numa
 * abre o seletor do sistema na hora. So com perfil: a foto mora no perfil.
 *
 * Quem ve: amigos aceitos e quem recebeu um pedido seu. O texto diz isso,
 * porque e a unica pergunta que alguem faz antes de subir o proprio rosto.
 */
function AvatarCard() {
  const status = useAuth((state) => state.status);
  const profile = useProfile((state) => state.profile);
  const loading = useProfile((state) => state.loading);
  const setAvatar = useProfile((state) => state.setAvatar);
  const removeAvatar = useProfile((state) => state.removeAvatar);
  // A URL guarda de qual caminho ela e: trocou a foto, a URL antiga deixa de
  // valer sozinha, sem precisar ser zerada.
  const [signed, setSigned] = useState<{ path: string; uri: string | null } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const path = profile?.avatarPath ?? null;
  const uri = signed && signed.path === path ? signed.uri : null;
  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    signedAvatarUrls([path])
      .then((urls) => {
        if (!cancelled) setSigned({ path, uri: urls.get(path) ?? null });
      })
      // Sem URL fica a inicial: a foto e um enfeite desta tela, nao o conteudo.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (status !== 'signedIn' || !profile) return null;

  async function choose() {
    setFailure(null);
    try {
      const jpeg = await pickAvatar();
      if (!jpeg) return;
      if ((await setAvatar(jpeg)) === 'error') setFailure('Não foi possível salvar a foto');
    } catch {
      setFailure('Não foi possível abrir a foto');
    }
  }

  async function remove() {
    setFailure(null);
    if ((await removeAvatar()) === 'error') setFailure('Não foi possível remover a foto');
  }

  return (
    <Card>
      <CardTitle color={section.profile} icon={<ImageIcon size={18} color="#FFFFFF" filled />}>Foto</CardTitle>
      <View style={styles.avatarRow}>
        <Avatar
          handle={profile.handle}
          uri={uri}
          path={path}
          color={people.self}
          size={72}
        />
        <View style={styles.rowText}>
          <Meta>
            {failure ?? 'Visível apenas para amigos'}
          </Meta>
          <View style={styles.avatarActions}>
            <Button
              variant="inline"
              label={path ? 'Trocar foto' : 'Escolher foto'}
              onPress={() => void choose()}
              disabled={loading}
            />
            {path ? (
              <Button
                variant="inline"
                label="Remover"
                onPress={() => void remove()}
                disabled={loading}
              />
            ) : null}
          </View>
        </View>
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
}): string | null {
  if (loading) return 'carregando…';
  // Sem cor de estado: a falha se comunica por texto, como no resto da tela.
  if (error) return `${error}, toque para tentar de novo`;
  if (!profile) return 'Como seus amigos te encontram';

  const traits = [
    profile.age === null ? null : `${profile.age} anos`,
    profile.trainingYears === null ? null : `${profile.trainingYears} de treino`,
  ].filter(Boolean);

  return traits.length > 0 ? traits.join(' · ') : null;
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
      <CardTitle color={section.profile} icon={<PeopleIcon size={18} color="#FFFFFF" filled />}>Amigos</CardTitle>
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
  if (pending === 0) return 'Buscar e gerenciar';
  return pending === 1 ? '1 pedido pendente' : `${pending} pedidos pendentes`;
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
      <CardTitle color={section.profile} icon={<ShareIcon size={18} color="#FFFFFF" filled />}>Compartilhar</CardTitle>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Body>Estatísticas</Body>
          <Meta>
            {profile.sharesStats
              ? 'Compartilhando com amigos'
              : 'Oculto para amigos'}
          </Meta>
        </View>
        <CheckCell
          checked={profile.sharesStats}
          onPress={() => {
            confirm();
            void save({ sharesStats: !profile.sharesStats }, true);
          }}
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
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const staffPanel = useFlag(FLAG_STAFF_PANEL);

  if (!isCloudConfigured) {
    return (
      <Card>
        <CardTitle color={section.profile} icon={<CloudIcon size={18} color="#FFFFFF" filled />}>Nuvem</CardTitle>
        <View style={styles.rowText}>
          <Body>Modo offline</Body>
          <Meta>Configure o .env para sincronizar</Meta>
        </View>
      </Card>
    );
  }

  if (status !== 'signedIn') {
    return (
      <Card onPress={() => router.push('/login')}>
        <CardTitle color={section.profile} icon={<CloudIcon size={18} color="#FFFFFF" filled />}>Nuvem</CardTitle>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Body>Entrar</Body>
            <Meta>Backup e sincronização</Meta>
            {staffPanel ? <Meta>{STAFF_PANEL_NOTICE}</Meta> : null}
          </View>
          <ChevronRightIcon size={16} color={colors.textSecondary} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle color={section.profile} icon={<CloudIcon size={18} color="#FFFFFF" filled />}>Nuvem</CardTitle>

      <Pressable style={styles.row} onPress={() => void runSync()} disabled={syncing}>
        <View style={styles.rowText}>
          <Body numberOfLines={1}>{email}</Body>
          <Meta>{syncStatusText(syncing, pending, lastSync?.error ?? null)}</Meta>
          {staffPanel ? <Meta>{STAFF_PANEL_NOTICE}</Meta> : null}
        </View>
        <SyncIcon size={18} color={colors.textSecondary} />
      </Pressable>

      <Pressable style={styles.row} onPress={() => setConfirmingSignOut(true)}>
        <View style={styles.rowText}>
          <Body>Sair</Body>
          <Meta>Remove os dados deste aparelho</Meta>
        </View>
      </Pressable>

      <ConfirmModal
        visible={confirmingSignOut}
        title="Sair e apagar os dados deste aparelho?"
        message={
          // Sair apaga o banco local: o que ainda esta na fila nao volta.
          pending > 0
            ? `${pending} ${pending === 1 ? 'mudança ainda não foi sincronizada e vai se perder' : 'mudanças ainda não foram sincronizadas e vão se perder'}.`
            : 'O que já foi sincronizado volta quando você entrar de novo.'
        }
        cancelLabel="Cancelar"
        confirmLabel="Sair"
        onClose={() => setConfirmingSignOut(false)}
        onConfirm={() => void signOut()}
      />
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
      <CardTitle color={section.profile} icon={<InfoIcon size={18} color="#FFFFFF" filled />}>Créditos</CardTitle>
      <View style={styles.rowText}>
        <Body>Figuras dos exercícios</Body>
        <Meta>Bryl Lim · workout-guide, derivado de Everkinetic · CC BY-SA 4.0</Meta>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.sm,
  },
  avatarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

/**
 * Titulo de card do Perfil, no jeito dos Ajustes do iPhone: o icone dentro de
 * um quadrado colorido e o nome em texto de corpo. Cada item tem a sua cor, e e
 * por ela que se acha o item sem precisar ler a tela inteira.
 */
function CardTitle({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: string;
}) {
  return (
    <View style={titleStyles.row}>
      <View style={[titleStyles.square, { backgroundColor: color }]}>{icon}</View>
      <Text style={titleStyles.text}>{children}</Text>
    </View>
  );
}

const titleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  square: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: theme.onSurface,
  },
});

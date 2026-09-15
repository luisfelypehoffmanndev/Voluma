import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { listBodyWeightLogs } from '@/db/repo';
import { formatWeight } from '@/domain/volume';
import { useQuery } from '@/store/data';
import { useAuth } from '@/sync/auth';
import { isCloudConfigured } from '@/sync/supabase';
import { colors, spacing } from '@/theme/tokens';
import { usePrefs } from '@/store/prefs';
import { Card } from '@/ui/Card';
import { CheckCell } from '@/ui/CheckCell';
import { preview } from '@/ui/haptics';
import { relativeTime } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { TabScene } from '@/ui/TabScene';
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

  const { data: weights } = useQuery(useCallback(() => listBodyWeightLogs(1), []));
  const latest = weights?.[0] ?? null;

  return (
    <TabScene>
      <Screen>
        <Header title="Perfil" />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
          showsVerticalScrollIndicator={false}
        >
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

          <MotionCard />

          <SyncCard />

          <CreditsCard />
        </ScrollView>
      </Screen>
    </TabScene>
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
          <Meta>um toque ao marcar concluído · nunca ao navegar</Meta>
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
  empty: {
    paddingTop: spacing.lg,
  },
});

import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { listExercises, listRoutines, listRoutineExercises } from '@/db/repo';
import type { Weekday } from '@/domain/types';
import { weekPlan, weekdayName } from '@/domain/week';
import { useQuery } from '@/store/data';
import { useAuth } from '@/sync/auth';
import { isCloudConfigured } from '@/sync/supabase';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta } from '@/ui/Text';
import { ChevronRightIcon, SyncIcon } from '@/ui/icons';

/** Ajustes: o plano da semana inteiro em uma tela, mais o catalogo de movimentos. */
export default function SettingsScreen() {
  const clearance = useTabBarClearance();
  const router = useRouter();

  const { data } = useQuery(
    useCallback(async () => {
      const [routines, exercises] = await Promise.all([listRoutines(), listExercises()]);
      // Os sete dias sao sintetizados aqui; no banco so existe linha para os
      // dias que ja receberam nome ou exercicio.
      const days = weekPlan(routines);
      const counts = await Promise.all(
        days.map(async (day) => (day ? (await listRoutineExercises(day.id)).length : 0)),
      );
      return { days, counts, exercises };
    }, []),
  );

  const days = data?.days ?? [];
  const counts = data?.counts ?? [];

  return (
    <Screen>
      {/* Sem acao de criar: os sete dias sao permanentes, nao se criam nem se
          apagam. */}
      <Header title="Ajustes" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Label>Plano da semana</Label>
          {days.map((day, weekday) => {
            const count = counts[weekday] ?? 0;
            return (
              <Pressable
                key={weekday}
                style={styles.row}
                onPress={() => router.push({ pathname: '/day/[weekday]', params: { weekday } })}
              >
                <View style={styles.rowText}>
                  <Body numberOfLines={1}>{weekdayName(weekday as Weekday)}</Body>
                  <Meta>{daysummary(day?.name ?? '', count)}</Meta>
                </View>
                <ChevronRightIcon size={16} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </Card>

        <Card>
          <Label>Catálogo</Label>
          <View style={styles.rowText}>
            <Body style={styles.catalogCount}>{data?.exercises.length ?? 0} movimentos</Body>
            <Meta>criados a partir dos dias</Meta>
          </View>
        </Card>

        <SyncCard />
      </ScrollView>
    </Screen>
  );
}

/**
 * O que a linha do dia diz embaixo do nome: o rotulo que o usuario deu, ou o
 * estado do dia quando ele nao deu nenhum.
 *
 * Dia sem nome mas com exercicios nao e descanso — e um dia que ainda nao foi
 * batizado, e a contagem ja diz o que importa.
 */
function daysummary(name: string, count: number): string {
  const label = name.trim();
  if (count === 0) return label || 'Descanso';
  const plural = count === 1 ? 'exercício' : 'exercícios';
  return label ? `${label} · ${count} ${plural}` : `${count} ${plural}`;
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
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
    marginTop: spacing.sm,
  },
  catalogCount: {
    fontSize: fontSize.bodyLg,
  },
  empty: {
    paddingTop: spacing.lg,
  },
});

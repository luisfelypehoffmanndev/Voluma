import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listExercises, listRoutines, listRoutineExercises } from '@/db/repo';
import type { Weekday } from '@/domain/types';
import { weekPlan, weekdayName } from '@/domain/week';
import { useQuery } from '@/store/data';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { PressableSurface } from '@/ui/PressableSurface';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { useTabBarClearance } from '@/ui/tabBar';
import { Body, Label, Meta } from '@/ui/Text';
import { ChevronRightIcon } from '@/ui/icons';

/**
 * Plano: a semana inteira e o catalogo de movimentos.
 *
 * Morava em Ajustes. Montar o treino e conteudo, nao configuracao — quem quer
 * decidir o que faz na segunda nao procura atras de um icone de sliders.
 *
 * Sem acao de criar: os sete dias sao permanentes, nao se criam nem se apagam.
 */
export default function PlanScreen() {
  const clearance = useTabBarClearance();
  const router = useRouter();

  const { data, error, reload } = useQuery(
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
      <Header title="Plano" />

      {error ? <LoadError error={error} onRetry={reload} /> : (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Label>Semana</Label>
          {days.map((day, weekday) => {
            const count = counts[weekday] ?? 0;
            return (
              <PressableSurface
                key={weekday}
                feedback="solid"
                style={styles.row}
                onPress={() => router.push({ pathname: '/day/[weekday]', params: { weekday } })}
                accessibilityLabel={`Editar ${weekdayName(weekday as Weekday)}`}
              >
                <View style={styles.rowText}>
                  <Body numberOfLines={1}>{weekdayName(weekday as Weekday)}</Body>
                  <Meta>{daySummary(day?.name ?? '', count)}</Meta>
                </View>
                <ChevronRightIcon size={16} color={colors.textSecondary} />
              </PressableSurface>
            );
          })}
        </Card>

        <Card onPress={() => router.push('/catalog')}>
          <Label>Catálogo</Label>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Body style={styles.catalogCount}>{data?.exercises.length ?? 0} movimentos</Body>
              <Meta>adicionar, apagar e organizar por grupo</Meta>
            </View>
            <ChevronRightIcon size={16} color={colors.textSecondary} />
          </View>
        </Card>
      </ScrollView>
      )}
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
function daySummary(name: string, count: number): string {
  const label = name.trim();
  if (count === 0) return label || 'Descanso';
  const plural = count === 1 ? 'exercício' : 'exercícios';
  return label ? `${label} · ${count} ${plural}` : `${count} ${plural}`;
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
  catalogCount: {
    fontSize: fontSize.bodyLg,
  },
});

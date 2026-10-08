import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listExercises, listRoutines, routineExerciseCounts } from '@/db/repo';
import type { Weekday } from '@/domain/types';
import { weekPlan, weekdayName, weekdayOf } from '@/domain/week';
import { useQuery } from '@/store/data';
import { colors, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { PressableSurface } from '@/ui/PressableSurface';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { Tour } from '@/ui/tour/Tour';
import { TourTarget } from '@/ui/tour/TourTarget';
import { useTabBarClearance } from '@/ui/tabBar';
import { Label, Meta, Section } from '@/ui/Text';
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
      const [routines, exercises, perRoutine] = await Promise.all([
        listRoutines(),
        listExercises(),
        routineExerciseCounts(),
      ]);
      // Os sete dias sao sintetizados aqui; no banco so existe linha para os
      // dias que ja receberam nome ou exercicio.
      const days = weekPlan(routines);
      const counts = days.map((day) => (day ? (perRoutine.get(day.id) ?? 0) : 0));
      return { days, counts, exercises };
    }, []),
  );

  const days = data?.days ?? [];
  const counts = data?.counts ?? [];
  const today = weekdayOf(new Date());

  return (
    <Screen
      overlay={
        /* O Plano e a tela que ninguem adivinha: o dia da semana e que guarda
           os exercicios, e e tocando nele que se monta o treino. Vai no
           `overlay` pelo mesmo motivo da Hoje — coordenadas de janela. */
        <Tour
          id="plan"
          active={data != null}
          steps={[
            {
              target: 'plan.week',
              text: 'Toque num dia para escolher os exercícios dele. Vale para toda semana.',
            },
          ]}
        />
      }
    >
      <Header title="Plano" />

      {error ? <LoadError error={error} onRetry={reload} /> : (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        <Label style={styles.sectionLabel}>SUA SEMANA</Label>

        <TourTarget id="plan.week">
        <Card>
          {days.map((day, weekday) => {
            const count = counts[weekday] ?? 0;
            // Hoje e o unico dia com accent na tela: num plano de sete linhas
            // iguais, nada dizia em qual delas o usuario esta.
            const isToday = weekday === today;
            return (
              <PressableSurface
                key={weekday}
                feedback="solid"
                style={[styles.row, weekday > 0 && styles.rowDivided]}
                onPress={() => router.push({ pathname: '/day/[weekday]', params: { weekday } })}
                accessibilityLabel={`Editar ${weekdayName(weekday as Weekday)}${isToday ? ', hoje' : ''}`}
              >
                <View style={styles.rowText}>
                  <View style={styles.dayLine}>
                    <Section numberOfLines={1}>{weekdayName(weekday as Weekday)}</Section>
                    {isToday ? <Label style={styles.todayTag}>HOJE</Label> : null}
                  </View>
                  <Meta>{daySummary(day?.name ?? '', count)}</Meta>
                </View>
                <ChevronRightIcon size={16} color={colors.textSecondary} />
              </PressableSurface>
            );
          })}
        </Card>
        </TourTarget>

        <Label style={styles.sectionLabel}>MOVIMENTOS</Label>

        <Card onPress={() => router.push('/catalog')}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Section>{`${data?.exercises.length ?? 0} no catálogo`}</Section>
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
  sectionLabel: {
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  dayLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** O unico accent da tela: onde o usuario esta na semana. */
  todayTag: {
    color: colors.accent,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});

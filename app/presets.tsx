import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  adoptPlan,
  adoptPresetIntoDay,
  listLocalPlans,
  listLocalPresetExercises,
  listLocalPresets,
  listRoutines,
  routineExerciseCounts,
} from '@/db/repo';
import type { GymPlan, GymPreset, GymPresetExercise, Weekday } from '@/domain/types';
import { weekPlan, weekdayName } from '@/domain/week';
import { findMovementBySlug } from '@/movements/library';
import { bumpData, useQuery } from '@/store/data';
import { FLAG_SUGGESTED_WORKOUTS, useFlag } from '@/store/flags';
import { colors, fontSize, radius, spacing, surfaces } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { EmptyState } from '@/ui/EmptyState';
import { confirm } from '@/ui/haptics';
import { LoadError } from '@/ui/LoadError';
import { PressableSurface } from '@/ui/PressableSurface';
import { Header, Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { Body, Meta, Mono, Section } from '@/ui/Text';
import { GYM } from '@/world';

export type PresetWithExercises = {
  preset: GymPreset;
  exercises: GymPresetExercise[];
};

export default function PresetsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [adoptingPreset, setAdoptingPreset] = useState<GymPreset | null>(null);
  const [targetWeekday, setTargetWeekday] = useState<Weekday | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adoptingPlan, setAdoptingPlan] = useState<GymPlan | null>(null);
  const suggestedOn = useFlag(FLAG_SUGGESTED_WORKOUTS);

  const { data, loading, error, reload } = useQuery(
    useCallback(async () => {
      const presets = await listLocalPresets(GYM);
      const withExercises = await Promise.all(
        presets.map(async (preset) => {
          const exercises = await listLocalPresetExercises(preset.id);
          return { preset, exercises };
        }),
      );

      const [routines, perRoutine, plans] = await Promise.all([
        listRoutines(),
        routineExerciseCounts(),
        listLocalPlans(GYM),
      ]);

      const days = weekPlan(routines);
      const counts = days.map((day) => (day ? (perRoutine.get(day.id) ?? 0) : 0));

      return { presets: withExercises, days, counts, plans };
    }, []),
  );

  const handleSelectDay = (weekday: Weekday) => {
    if (!adoptingPreset || !data) return;
    const currentCount = data.counts[weekday] ?? 0;
    if (currentCount > 0) {
      setTargetWeekday(weekday);
      setConfirmReplace(true);
    } else {
      void executeAdoption(adoptingPreset.id, weekday);
    }
  };

  const executePlanAdoption = async (plan: GymPlan) => {
    if (saving) return;
    try {
      setSaving(true);
      setFailed(false);
      await adoptPlan(plan.id, GYM);
      confirm();
      bumpData();
      setAdoptingPlan(null);
      reload();
    } catch (err) {
      console.warn('[Voluma] falha ao seguir plano', err);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const closeAdoption = () => {
    setAdoptingPreset(null);
    setFailed(false);
  };

  const executeAdoption = async (presetId: string, weekday: Weekday) => {
    // Um segundo toque em "Substituir" enquanto a primeira adocao corre so
    // repetiria a mesma escrita.
    if (saving) return;
    try {
      setSaving(true);
      setFailed(false);
      await adoptPresetIntoDay(presetId, weekday);
      confirm();
      bumpData();
      setAdoptingPreset(null);
      setTargetWeekday(null);
      setConfirmReplace(false);
      reload();
    } catch (err) {
      console.warn('[Voluma] falha ao adotar ficha sugerida', err);
      setFailed(true);
      setConfirmReplace(false);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <Header title="Fichas da academia" back />
        <LoadError error={error} onRetry={reload} />
      </Screen>
    );
  }

  if (loading || !data) {
    return (
      <Screen>
        <Header title="Fichas da academia" back />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { days, counts } = data;
  // Flag desligada: a academia tirou as fichas do ar, mesmo com o cache cheio.
  const presets = suggestedOn ? data.presets : [];
  const presetName = (id: string) => data.presets.find((p) => p.preset.id === id)?.preset.name ?? 'Treino';
  // So os abertos se escolhem; o plano que a pessoa ja segue aparece marcado.
  const followed = new Set(days.map((day) => day?.planId).filter((id): id is string => Boolean(id)));
  const plans = suggestedOn ? data.plans.filter((p) => p.openToStudents || followed.has(p.id)) : [];
  // Dias com treino que o plano substituiria (menos os que ja seguem este plano).
  const replacedDays = (plan: GymPlan) =>
    plan.days
      .filter((d) => (counts[d.weekday] ?? 0) > 0 && days[d.weekday]?.planId !== plan.id)
      .map((d) => weekdayName(d.weekday).toLowerCase());

  return (
    <Screen>
      <Header title="Fichas da academia" back />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Body style={styles.lead}>
          Treinos montados pelos instrutores. Ao colocar na sua semana, as alterações de séries e repetições
          são atualizadas dinamicamente, mantendo sempre as suas cargas individuais.
        </Body>

        {plans.length > 0 ? <Section>Planos</Section> : null}
        {plans.map((plan) => (
          <Card key={plan.id} style={styles.presetCard}>
            <View style={styles.presetHeader}>
              <View style={styles.titleContainer}>
                <Section>{plan.name}</Section>
                <Meta>
                  {plan.days.map((d) => `${weekdayName(d.weekday).slice(0, 3)} ${presetName(d.presetId)}`).join(' · ') ||
                    'Sem dias'}
                </Meta>
              </View>
              {followed.has(plan.id) ? (
                <Meta>Você segue</Meta>
              ) : (
                <Button label="Seguir plano" onPress={() => setAdoptingPlan(plan)} />
              )}
            </View>
          </Card>
        ))}
        {plans.length > 0 && presets.length > 0 ? <Section>Fichas</Section> : null}

        {presets.length === 0 && plans.length === 0 ? (
          <EmptyState
            title="Nenhuma ficha cadastrada"
            message="Sua academia ainda não cadastrou treinos sugeridos no sistema."
            action={{
              label: 'Voltar',
              onPress: () => router.back(),
            }}
          />
        ) : (
          presets.map(({ preset, exercises }) => (
            <Card key={preset.id} style={styles.presetCard}>
              <View style={styles.presetHeader}>
                <View style={styles.titleContainer}>
                  <Section>{preset.name}</Section>
                  <Meta>
                    {exercises.length === 1
                      ? '1 exercício'
                      : `${exercises.length} exercícios`}
                  </Meta>
                </View>
                <Button
                  label="Colocar na semana"
                  onPress={() => setAdoptingPreset(preset)}
                />
              </View>

              <View style={styles.exerciseList}>
                {exercises.map((item, idx) => {
                  // O `name` da ficha e o que a adocao grava no plano; a
                  // biblioteca so cobre uma ficha cadastrada sem nome.
                  const name =
                    item.name.trim() ||
                    findMovementBySlug(item.movementSlug)?.name ||
                    item.movementSlug;
                  const targetText =
                    item.targetDistanceKm > 0 || item.targetDurationMin > 0
                      ? `${item.targetDistanceKm} km · ${item.targetDurationMin} min`
                      : `${item.targetSets} × ${item.targetReps}`;

                  return (
                    <View
                      key={item.id}
                      style={[styles.exerciseRow, idx > 0 && styles.exerciseDivided]}
                    >
                      <Body style={styles.exerciseName} numberOfLines={1}>
                        {name}
                      </Body>
                      <Mono style={styles.exerciseTargets}>{targetText}</Mono>
                    </View>
                  );
                })}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Modal seletor de dia da semana */}
      <Sheet
        visible={adoptingPreset != null && !confirmReplace}
        onClose={closeAdoption}
      >
        <Body style={styles.modalTitle}>Em qual dia você quer treinar?</Body>
        <Meta style={styles.modalSubtitle}>
          {adoptingPreset ? `Colocar "${adoptingPreset.name}" no seu plano semanal.` : ''}
        </Meta>

        <View style={styles.dayList}>
          {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((weekday) => {
            const day = days[weekday];
            const count = counts[weekday] ?? 0;
            const status = count > 0 ? `${day?.name || 'Treino'} · ${count} exs` : 'Descanso';

            return (
              <PressableSurface
                key={weekday}
                feedback="solid"
                style={styles.dayOption}
                onPress={() => handleSelectDay(weekday)}
                accessibilityLabel={`Escolher ${weekdayName(weekday)}`}
              >
                <View style={styles.dayOptionText}>
                  <Body>{weekdayName(weekday)}</Body>
                  <Meta>{status}</Meta>
                </View>
              </PressableSurface>
            );
          })}
        </View>

        {failed ? <Meta>Não foi possível colocar a ficha na semana. Tente de novo.</Meta> : null}

        <Button
          label="Cancelar"
          variant="inline"
          onPress={closeAdoption}
          style={styles.cancelBtn}
        />
      </Sheet>

      {/* Seguir um plano: diz quais dias com treino ele substitui */}
      <ConfirmModal
        visible={adoptingPlan != null}
        title={`Seguir "${adoptingPlan?.name ?? ''}"?`}
        message={(() => {
          if (!adoptingPlan) return '';
          const replaced = replacedDays(adoptingPlan);
          const base = 'Os dias do plano recebem os treinos dele, com as suas cargas.';
          const tail = replaced.length
            ? ` Substitui o treino de ${replaced.join(', ')}. O histórico continua salvo.`
            : ' Nenhum dia com treino seu é substituído.';
          return base + tail + (failed ? ' Não foi possível seguir o plano. Tente de novo.' : '');
        })()}
        confirmLabel={saving ? 'Aplicando...' : 'Seguir plano'}
        cancelLabel="Voltar"
        onClose={() => {
          setAdoptingPlan(null);
          setFailed(false);
        }}
        onConfirm={() => {
          if (adoptingPlan) void executePlanAdoption(adoptingPlan);
        }}
      />

      {/* Confirmação de substituição de dia existente */}
      <ConfirmModal
        visible={confirmReplace && adoptingPreset != null && targetWeekday != null}
        title={`Substituir treino de ${targetWeekday != null ? weekdayName(targetWeekday) : ''}?`}
        message={`O plano atual deste dia será substituído pela ficha "${adoptingPreset?.name}". O histórico de treinos já realizados continuará salvo.`}
        confirmLabel={saving ? 'Adotando...' : 'Substituir'}
        cancelLabel="Voltar"
        onClose={() => setConfirmReplace(false)}
        onConfirm={() => {
          if (adoptingPreset && targetWeekday != null) {
            void executeAdoption(adoptingPreset.id, targetWeekday);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  lead: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  presetCard: {
    gap: spacing.md,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  exerciseList: {
    backgroundColor: surfaces.raised,
    borderRadius: radius.inner,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  exerciseDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  exerciseName: {
    flex: 1,
  },
  exerciseTargets: {
    color: colors.textSecondary,
  },
  modalTitle: {
    fontSize: fontSize.bodyLg,
  },
  modalSubtitle: {
    marginBottom: spacing.xs,
  },
  dayList: {
    gap: spacing.xs,
    marginVertical: spacing.sm,
  },
  dayOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.inner,
    backgroundColor: surfaces.raised,
  },
  dayOptionText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    marginTop: spacing.sm,
  },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addExerciseToRoutine,
  addExerciseToSession,
  addSet,
  createExercise,
  finishSession,
  getRoutine,
  getSession,
  listExercises,
  listSessionSets,
  removeSet,
  updateSet,
} from '@/db/repo';
import type { SessionSet } from '@/domain/types';
import { weekdayName } from '@/domain/week';
import {
  completedSets,
  formatVolume,
  formatWeight,
  totalVolume,
  volumeByExercise,
} from '@/domain/volume';
import { bumpData, useQuery } from '@/store/data';
import { useAuth } from '@/sync/auth';
import { colors, fontSize, hitSlop, radius, spacing } from '@/theme/tokens';
import { DashedBar } from '@/ui/DashedBar';
import { DEFAULT_TARGETS, ExercisePicker } from '@/ui/ExercisePicker';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { Body, Label, Meta } from '@/ui/Text';
import { ArrowDownIcon, CheckIcon, PlusIcon, TrashIcon } from '@/ui/icons';
import { Stepper } from '@/ui/Stepper';

/**
 * Treino em andamento.
 *
 * O volume no topo e a barra pontilhada atualizam a cada serie marcada — e o
 * feedback que justifica marcar. A tela nao tem tab bar: enquanto o treino esta
 * aberto, nao ha para onde ir.
 *
 * Escritas sao otimistas: o estado local muda na hora e o SQLite grava em
 * seguida. Marcar serie com o celular na mao suada nao pode esperar I/O.
 */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { data, loading, reload } = useQuery(
    useCallback(async () => {
      const [session, sets, exercises] = await Promise.all([
        getSession(id),
        listSessionSets(id),
        listExercises(),
      ]);
      const routine = session?.routineId ? await getRoutine(session.routineId) : null;
      return {
        session,
        routine,
        sets,
        catalog: exercises,
        names: new Map(exercises.map((e) => [e.id, e.name])),
      };
    }, [id]),
  );

  const [overrides, setOverrides] = useState<Map<string, Partial<SessionSet>>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  if (loading || !data?.session) {
    return (
      <Screen>
        <Header title="Treino" />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  // Aplica as escritas otimistas por cima do que veio do banco.
  const sets = data.sets.map((set) => ({ ...set, ...overrides.get(set.id) }));
  const groups = groupByExercise(sets, data.names);

  const patch = (setId: string, change: Partial<SessionSet>) => {
    setOverrides((current) => {
      const next = new Map(current);
      next.set(setId, { ...next.get(setId), ...change });
      return next;
    });
    updateSet(setId, change).then(bumpData);
  };

  const volume = totalVolume(sets);
  const done = completedSets(sets);
  const progress = sets.length === 0 ? 0 : done / sets.length;

  const finish = async () => {
    await finishSession(id);
    bumpData();
    router.back();
    // Fim de treino e o melhor momento para tentar subir: normalmente o
    // usuario ja saiu da area morta da academia. Se falhar, a outbox segura.
    void useAuth.getState().runSync();
  };

  const routine = data.routine;

  /**
   * Adicionar movimento aqui e recorrente por padrao: entra na rotina daquele
   * dia da semana E aparece no treino de hoje. Adicionar remada na segunda faz
   * toda segunda ja vir com ela.
   *
   * Treino livre (sem rotina) nao tem o que tornar recorrente — nesse caso
   * entra so na sessao, e o texto do botao avisa.
   */
  const addExercise = async (exerciseId: string) => {
    if (routine) {
      await addExerciseToRoutine(routine.id, exerciseId, DEFAULT_TARGETS);
    }
    await addExerciseToSession(id, exerciseId, DEFAULT_TARGETS);
    bumpData();
    setPicking(false);
    reload();
  };

  const usedExercises = new Set(sets.map((set) => set.exerciseId));

  return (
    <Screen>
      <Header
        title="Treino"
        action={{ icon: <ArrowDownIcon size={20} />, onPress: () => router.back() }}
      />

      <View style={styles.summary}>
        <StatNumber value={formatVolume(volume)} unit="kg" size={fontSize.numberLg} />
        <View style={styles.summaryMeta}>
          <Label>Volume levantado</Label>
          <Meta>
            {done} de {sets.length} séries
          </Meta>
        </View>
        <DashedBar
          progress={progress}
          width={width - spacing.xl * 2}
          style={styles.bar}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View key={group.exerciseId} style={styles.group}>
            <Pressable
              style={styles.groupHeader}
              onPress={() =>
                setExpanded((current) =>
                  current === group.exerciseId ? null : group.exerciseId,
                )
              }
            >
              <View style={styles.groupTitle}>
                <Body numberOfLines={1}>{group.name}</Body>
                <Meta>
                  {group.doneCount}/{group.sets.length} séries ·{' '}
                  {formatVolume(group.volume)} kg
                </Meta>
              </View>
            </Pressable>

            {group.sets.map((set) => {
              const isOpen = expanded === group.exerciseId;
              return (
                <View key={set.id} style={styles.setRow}>
                  <Pressable
                    hitSlop={hitSlop}
                    onPress={() => patch(set.id, { done: !set.done })}
                    style={[styles.check, set.done && styles.checkDone]}
                  >
                    {set.done ? <CheckIcon size={14} color={colors.bg} /> : null}
                  </Pressable>

                  <Label style={styles.setIndex}>{set.setIndex}</Label>

                  {isOpen ? (
                    <View style={styles.steppers}>
                      <Stepper
                        label="REPS"
                        value={set.reps}
                        min={0}
                        onChange={(reps) => patch(set.id, { reps })}
                      />
                      <Stepper
                        label="PESO"
                        value={set.weightKg}
                        step={2.5}
                        min={0}
                        suffix="kg"
                        format={formatWeight}
                        onChange={(weightKg) => patch(set.id, { weightKg })}
                      />
                      <Pressable
                        hitSlop={hitSlop}
                        onPress={() => {
                          removeSet(set.id).then(bumpData);
                        }}
                        style={styles.remove}
                      >
                        <TrashIcon size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.compact}>
                      <Body style={styles.compactValue}>
                        {set.reps} × {formatWeight(set.weightKg)} kg
                      </Body>
                      <Meta>{formatVolume(set.reps * set.weightKg)} kg</Meta>
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable
              style={styles.addSet}
              onPress={() => {
                addSet(id, group.exerciseId).then(bumpData);
              }}
            >
              <PlusIcon size={14} color={colors.textSecondary} />
              <Label style={styles.addSetLabel}>Série extra</Label>
            </Pressable>
          </View>
        ))}

        {groups.length === 0 ? (
          <Meta style={styles.empty}>Nenhum exercício neste treino ainda.</Meta>
        ) : null}

        {/*
          Fica no fim da lista, nao como segundo botao flutuante: "Finalizar
          treino" continua sendo o unico, e o unico accent da tela.
        */}
        <Pressable style={styles.addExercise} onPress={() => setPicking(true)}>
          <PlusIcon size={16} color={colors.textPrimary} />
          <View style={styles.addExerciseText}>
            <Body>Adicionar exercício</Body>
            <Meta>
              {routine
                ? `entra também toda ${weekdayName(routine.weekday).toLowerCase()}`
                : 'só neste treino — sem rotina para repetir'}
            </Meta>
          </View>
        </Pressable>
      </ScrollView>

      {/* Unico accent da tela: o botao que encerra o treino. */}
      <Pressable
        onPress={finish}
        style={({ pressed }) => [
          styles.finish,
          { bottom: insets.bottom + spacing.xl },
          pressed && styles.finishPressed,
        ]}
      >
        <Body style={styles.finishLabel}>Finalizar treino</Body>
      </Pressable>

      <ExercisePicker
        visible={picking}
        catalog={data.catalog.filter((exercise) => !usedExercises.has(exercise.id))}
        subtitle={
          routine
            ? `Passa a valer toda ${weekdayName(routine.weekday).toLowerCase()}`
            : 'Só neste treino'
        }
        onClose={() => setPicking(false)}
        onPick={addExercise}
        onCreate={async (name) => {
          const exercise = await createExercise(name);
          await addExercise(exercise.id);
        }}
      />
    </Screen>
  );
}

type Group = {
  exerciseId: string;
  name: string;
  sets: SessionSet[];
  volume: number;
  doneCount: number;
};

function groupByExercise(sets: SessionSet[], names: Map<string, string>): Group[] {
  const volumes = volumeByExercise(sets);
  const order: string[] = [];
  const buckets = new Map<string, SessionSet[]>();

  for (const set of sets) {
    if (!buckets.has(set.exerciseId)) {
      buckets.set(set.exerciseId, []);
      order.push(set.exerciseId);
    }
    buckets.get(set.exerciseId)!.push(set);
  }

  return order.map((exerciseId) => {
    const bucket = buckets.get(exerciseId)!;
    return {
      exerciseId,
      name: names.get(exerciseId) ?? 'Exercício',
      sets: bucket.sort((a, b) => a.setIndex - b.setIndex),
      volume: volumes.get(exerciseId) ?? 0,
      doneCount: completedSets(bucket),
    };
  });
}

const styles = StyleSheet.create({
  summary: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  summaryMeta: {
    marginTop: spacing.xs,
    gap: 2,
  },
  bar: {
    marginTop: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  groupHeader: {
    paddingBottom: spacing.md,
  },
  groupTitle: {
    gap: 2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dotEmpty,
  },
  checkDone: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  setIndex: {
    width: 14,
  },
  compact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  compactValue: {
    fontSize: fontSize.body,
  },
  steppers: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  remove: {
    padding: spacing.xs,
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addSetLabel: {
    letterSpacing: 0.6,
  },
  empty: {
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
  },
  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    flex: 1,
    gap: 2,
  },
  finish: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishPressed: {
    opacity: 0.8,
  },
  finishLabel: {
    color: colors.textOnAccent,
  },
});

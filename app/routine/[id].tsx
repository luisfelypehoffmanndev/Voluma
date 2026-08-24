import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addExerciseToRoutine,
  createExercise,
  createRoutine,
  deleteRoutine,
  getRoutine,
  listExercises,
  listRoutineExercises,
  removeRoutineExercise,
  updateRoutine,
  updateRoutineExercise,
  type RoutineExerciseWithName,
} from '@/db/repo';
import type { Weekday } from '@/domain/types';
import { formatWeight } from '@/domain/volume';
import { weekdayInitials, weekdayLabel } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, hitSlop, radius, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { DEFAULT_TARGETS, ExercisePicker } from '@/ui/ExercisePicker';
import { GlassSurface } from '@/ui/GlassSurface';
import { Header, Screen } from '@/ui/Screen';
import { Stepper } from '@/ui/Stepper';
import { Body, Label, Meta } from '@/ui/Text';
import { ArrowDownIcon, TrashIcon } from '@/ui/icons';

/**
 * Edicao do plano de um dia da semana.
 *
 * A rota `/routine/new` cai aqui com `id === 'new'`: a rotina so e criada no
 * banco quando o usuario confirma o nome, para nao deixar rotinas vazias
 * orfas se ele desistir no meio.
 */
export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isNew = id === 'new';

  const [draftName, setDraftName] = useState('');
  const [draftWeekday, setDraftWeekday] = useState<Weekday>(1);
  const [picking, setPicking] = useState(false);

  const { data, loading, reload } = useQuery(
    useCallback(async () => {
      if (isNew) return { routine: null, items: [], catalog: await listExercises() };
      const [routine, items, catalog] = await Promise.all([
        getRoutine(id),
        listRoutineExercises(id),
        listExercises(),
      ]);
      return { routine, items, catalog };
    }, [id, isNew]),
  );

  const createAndOpen = async () => {
    const name = draftName.trim() || `Treino de ${weekdayLabel(draftWeekday).toLowerCase()}`;
    const routine = await createRoutine(name, draftWeekday);
    bumpData();
    router.replace(`/routine/${routine.id}`);
  };

  if (loading) {
    return (
      <Screen>
        <Header title="Rotina" />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  if (isNew) {
    return (
      <Screen>
        <Header
          title="Nova rotina"
          action={{ icon: <ArrowDownIcon size={20} />, onPress: () => router.back() }}
        />
        <View style={styles.content}>
          <Card>
            <Label>Nome</Label>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Peito + tríceps"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoFocus
            />
          </Card>

          <Card>
            <Label>Dia da semana</Label>
            <WeekdayPicker value={draftWeekday} onChange={setDraftWeekday} />
            <Meta style={styles.weekdayHint}>{weekdayLabel(draftWeekday)}</Meta>
          </Card>
        </View>

        <FloatingGlassButton
          label="Criar rotina"
          onPress={createAndOpen}
          bottom={insets.bottom + spacing.xl}
        />
      </Screen>
    );
  }

  if (!data?.routine) {
    return (
      <Screen>
        <Header
          title="Rotina"
          action={{ icon: <ArrowDownIcon size={20} />, onPress: () => router.back() }}
        />
        <Meta style={styles.empty}>Rotina não encontrada.</Meta>
      </Screen>
    );
  }

  const { routine, items, catalog } = data;
  const used = new Set(items.map((item) => item.exerciseId));

  const addToRoutine = async (exerciseId: string) => {
    await addExerciseToRoutine(routine.id, exerciseId, DEFAULT_TARGETS);
    bumpData();
    setPicking(false);
    reload();
  };

  return (
    <Screen>
      <Header
        title={routine.name}
        secondaryAction={{
          icon: <TrashIcon size={18} color={colors.textSecondary} />,
          onPress: async () => {
            await deleteRoutine(routine.id);
            bumpData();
            router.back();
          },
        }}
        action={{ icon: <ArrowDownIcon size={20} />, onPress: () => router.back() }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        // Sem isto, com o teclado do peso aberto, o primeiro toque em qualquer
        // outro lugar so fecha o teclado e se perde.
        keyboardShouldPersistTaps="handled"
        // Sobe a lista quando o teclado cobre o card que esta sendo editado.
        automaticallyAdjustKeyboardInsets
      >
        <Card>
          <Label>Dia da semana</Label>
          <WeekdayPicker
            value={routine.weekday}
            onChange={async (weekday) => {
              await updateRoutine(routine.id, { weekday });
              bumpData();
              reload();
            }}
          />
          <Meta style={styles.weekdayHint}>{weekdayLabel(routine.weekday)}</Meta>
        </Card>

        {items.map((item) => (
          <Card key={item.id}>
            <View style={styles.itemHead}>
              <Body numberOfLines={1} style={styles.itemName}>
                {item.exerciseName}
              </Body>
              <Pressable
                hitSlop={hitSlop}
                onPress={async () => {
                  await removeRoutineExercise(item.id);
                  bumpData();
                  reload();
                }}
              >
                <TrashIcon size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            <TargetsEditor item={item} />
          </Card>
        ))}

        {items.length === 0 ? (
          <Meta style={styles.empty}>Nenhum exercício nesta rotina.</Meta>
        ) : null}
      </ScrollView>

      <FloatingGlassButton
        label="Adicionar exercício"
        onPress={() => setPicking(true)}
        bottom={insets.bottom + spacing.xl}
      />

      <ExercisePicker
        visible={picking}
        catalog={catalog.filter((exercise) => !used.has(exercise.id))}
        subtitle={`Passa a valer toda ${weekdayLabel(routine.weekday).toLowerCase().replace(/s$/, '')}`}
        onClose={() => setPicking(false)}
        onPick={addToRoutine}
        onCreate={async (name) => {
          const exercise = await createExercise(name);
          await addToRoutine(exercise.id);
        }}
      />
    </Screen>
  );
}

/** Tempo de mao parada antes de gravar. Curto o bastante para nao se perder ao
 *  sair da tela, longo o bastante para um ajuste de 3 toques virar uma escrita. */
const COMMIT_DELAY = 400;

/**
 * Alvos de um exercicio da rotina: series, reps e carga.
 *
 * Os tres ficam empilhados, um por linha. Lado a lado eles nao cabem — cada
 * stepper pede 138px e a area util do card e ~310px num telefone comum, entao o
 * terceiro era cortado pelo `overflow: hidden` do Card.
 *
 * O valor exibido vive aqui, em estado local, e so desce para o banco depois que
 * a mao para. Antes cada toque gravava e recarregava, e o proximo toque somava em
 * cima do valor antigo que ainda estava na tela: dois toques rapidos no + viravam
 * um so. Os tres campos sao gravados juntos porque `updateRoutineExercise` grava
 * a linha inteira — commitar um de cada vez reescreveria os outros dois com o
 * valor velho.
 */
function TargetsEditor({ item }: { item: RoutineExerciseWithName }) {
  const [targets, setTargets] = useState({
    sets: item.targetSets,
    reps: item.targetReps,
    weightKg: item.targetWeightKg,
  });

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(targets);
  latest.current = targets;

  // Enquanto ha edicao pendente o banco esta atrasado em relacao a tela; aceitar
  // o valor dele aqui faria o numero voltar sozinho no meio do ajuste.
  useEffect(() => {
    if (dirty.current) return;
    setTargets({
      sets: item.targetSets,
      reps: item.targetReps,
      weightKg: item.targetWeightKg,
    });
  }, [item.targetSets, item.targetReps, item.targetWeightKg]);

  const commit = useCallback(() => {
    dirty.current = false;
    timer.current = null;
    updateRoutineExercise(item.id, latest.current).then(bumpData);
  }, [item.id]);

  // Sair da tela no meio do ajuste nao pode perder o ultimo toque.
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      commit();
    },
    [commit],
  );

  const change = (patch: Partial<typeof targets>) => {
    setTargets((current) => ({ ...current, ...patch }));
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, COMMIT_DELAY);
  };

  return (
    <View style={styles.targets}>
      <Stepper
        layout="row"
        label="SÉRIES"
        value={targets.sets}
        min={1}
        max={12}
        onChange={(sets) => change({ sets })}
      />
      <Stepper
        layout="row"
        label="REPS"
        value={targets.reps}
        min={1}
        max={100}
        onChange={(reps) => change({ reps })}
      />
      <Stepper
        layout="row"
        label="PESO"
        value={targets.weightKg}
        step={2.5}
        suffix="kg"
        editable
        format={formatWeight}
        onChange={(weightKg) => change({ weightKg })}
      />
    </View>
  );
}

/**
 * Botao fixo no rodape. Flutua sobre a lista rolavel, entao e vidro — a regra
 * do brief. O accent fica reservado para acoes terminais (finalizar, registrar);
 * estas sao acoes de edicao e nao competem por atencao.
 */
function FloatingGlassButton({
  label,
  onPress,
  bottom,
}: {
  label: string;
  onPress: () => void;
  bottom: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.floating, { bottom }, pressed && styles.pressed]}
    >
      <GlassSurface style={styles.floatingSurface}>
        <Body>{label}</Body>
      </GlassSurface>
    </Pressable>
  );
}

function WeekdayPicker({
  value,
  onChange,
}: {
  value: Weekday;
  onChange: (weekday: Weekday) => void;
}) {
  return (
    <View style={styles.weekdayRow}>
      {weekdayInitials().map((initial, index) => {
        const weekday = index as Weekday;
        const active = weekday === value;
        return (
          <Pressable
            key={index}
            onPress={() => onChange(weekday)}
            style={[styles.weekdayChip, active && styles.weekdayChipActive]}
          >
            <Label style={active ? styles.weekdayChipLabelActive : undefined}>
              {initial}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  input: {
    marginTop: spacing.sm,
    fontFamily: 'Inter_400Regular',
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  search: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  weekdayChip: {
    flex: 1,
    height: 38,
    borderRadius: radius.inner,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  weekdayChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  weekdayChipLabelActive: {
    color: colors.bg,
  },
  weekdayHint: {
    marginTop: spacing.sm,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  itemName: {
    flex: 1,
    marginRight: spacing.md,
  },
  targets: {
    marginTop: -spacing.xs,
  },
  empty: {
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
  },
  floating: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
  floatingSurface: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});

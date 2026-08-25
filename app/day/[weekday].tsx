import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addExerciseToRoutine,
  createExercise,
  ensureDayRoutine,
  ensureRunExercise,
  listExercises,
  removeRoutineExercise,
  setWeekTarget,
  targetsForWeek,
  updateRoutine,
  type TargetSource,
  type WeekExercise,
} from '@/db/repo';
import type { Targets, Weekday } from '@/domain/types';
import { addWeeks, weekRangeLabel, weekStartKey, weekdayName, weeksBetween } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, hitSlop, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { artSlugFor } from '@/movements/library';
import { DEFAULT_RUN_TARGETS, DEFAULT_TARGETS, ExercisePicker } from '@/ui/ExercisePicker';
import { FloatingGlassButton } from '@/ui/FloatingGlassButton';
import { Header, RoundButton, Screen } from '@/ui/Screen';
import { TargetsEditor } from '@/ui/TargetsEditor';
import { Body, Label, Meta } from '@/ui/Text';
import { ArrowDownIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '@/ui/icons';

/** Tempo de mao parada antes de gravar o rotulo do dia. */
const NAME_COMMIT_DELAY = 400;

/** De onde veio o numero que esta na tela. Sem isso o usuario nao sabe se o
 *  valor e uma escolha dele ou uma heranca do historico. */
const SOURCE_LABEL: Record<TargetSource, string> = {
  override: 'ajustado nesta semana',
  lastActual: 'como na última vez',
  plan: 'ainda não treinado',
};

/**
 * O plano de um dia da semana, semana a semana.
 *
 * A rota recebe o dia (0-6), nao o id de uma rotina: os sete dias sao
 * permanentes e nao se criam nem se apagam. A linha em `routines` nasce
 * sozinha na primeira escrita, via `ensureDayRoutine`.
 *
 * A semana e estado local, nao parametro de rota. Na URL, cinco toques no ‹
 * empilhariam cinco telas no historico e o botao voltar viraria uma viagem no
 * tempo em vez de sair da tela.
 */
export default function DayScreen() {
  const params = useLocalSearchParams<{ weekday: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const weekday = Number(params.weekday) as Weekday;
  const [weekStart, setWeekStart] = useState(() => weekStartKey(new Date()));
  const [picking, setPicking] = useState(false);

  const { data, loading, reload } = useQuery(
    useCallback(async () => {
      const routine = await ensureDayRoutine(weekday);
      // A corrida existe sob demanda: garantir aqui e o que a faz aparecer no
      // seletor sem precisar de backfill na migracao.
      await ensureRunExercise();
      const [items, catalog] = await Promise.all([
        targetsForWeek(weekStart, routine.id),
        listExercises(),
      ]);
      return { routine, items, catalog };
    }, [weekday, weekStart]),
  );

  if (loading || !data) {
    return (
      <Screen>
        <Header
          title={weekdayName(weekday)}
          action={{ icon: <ArrowDownIcon size={20} />, onPress: () => router.back() }}
        />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { routine, items, catalog } = data;
  const used = new Set(items.map((item) => item.exerciseId));
  const currentWeek = weekStartKey(new Date());

  const addToDay = async (exerciseId: string) => {
    const picked = catalog.find((exercise) => exercise.id === exerciseId);
    const initial = picked?.kind === 'run' ? DEFAULT_RUN_TARGETS : DEFAULT_TARGETS;
    await addExerciseToRoutine(routine.id, exerciseId, initial);
    bumpData();
    setPicking(false);
    reload();
  };

  return (
    <Screen>
      <Header
        title={weekdayName(weekday)}
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
          <Label>Nome do dia</Label>
          <DayNameInput routineId={routine.id} value={routine.name} />
        </Card>

        <Card>
          <Label>Semana</Label>
          <View style={styles.weekNav}>
            <RoundButton
              icon={<ChevronLeftIcon size={16} />}
              onPress={() => setWeekStart((week) => addWeeks(week, -1))}
            />
            <View style={styles.weekText}>
              <Body>{weekRangeLabel(weekStart)}</Body>
              <Meta>{weekOffsetLabel(weekStart, currentWeek)}</Meta>
            </View>
            <RoundButton
              icon={<ChevronRightIcon size={16} />}
              onPress={() => setWeekStart((week) => addWeeks(week, 1))}
            />
          </View>
        </Card>

        {items.map((item) => (
          <ExerciseCard
            key={item.id}
            item={item}
            weekStart={weekStart}
            onChanged={reload}
          />
        ))}

        {items.length === 0 ? (
          <Meta style={styles.empty}>Nenhum exercício neste dia. Descanso.</Meta>
        ) : null}
      </ScrollView>

      <FloatingGlassButton
        label="Adicionar exercício"
        onPress={() => setPicking(true)}
        bottom={insets.bottom + spacing.xl}
      />

      <ExercisePicker
        visible={picking}
        catalog={catalog}
        usedIds={used}
        subtitle={`Passa a valer toda ${weekdayName(weekday).toLowerCase()}`}
        onClose={() => setPicking(false)}
        onPick={addToDay}
        onCreate={async (name, muscleGroup, kind) => {
          const exercise = await createExercise(name, muscleGroup, kind);
          await addToDay(exercise.id);
        }}
      />
    </Screen>
  );
}

/** "semana atual", "semana que vem", "há 2 semanas". */
function weekOffsetLabel(weekStart: string, currentWeek: string): string {
  const offset = weeksBetween(currentWeek, weekStart);
  if (offset === 0) return 'semana atual';
  if (offset === 1) return 'semana que vem';
  if (offset === -1) return 'semana passada';
  if (offset > 0) return `daqui a ${offset} semanas`;
  return `há ${Math.abs(offset)} semanas`;
}

/**
 * Um exercicio do dia com os numeros da semana selecionada.
 *
 * `resetKey` amarra o editor a semana: trocar de semana descarta a edicao
 * pendente em vez de grava-la na semana errada.
 */
function ExerciseCard({
  item,
  weekStart,
  onChanged,
}: {
  item: WeekExercise;
  weekStart: string;
  onChanged: () => void;
}) {
  const commit = useCallback(
    (targets: Targets) => {
      setWeekTarget(weekStart, item.id, targets).then(bumpData);
    },
    [weekStart, item.id],
  );

  return (
    <Card>
      <View style={styles.itemHead}>
        <View style={styles.itemText}>
          <Body numberOfLines={1}>{item.exerciseName}</Body>
          <Meta>{SOURCE_LABEL[item.source]}</Meta>
        </View>
        <Pressable
          hitSlop={hitSlop}
          onPress={async () => {
            await removeRoutineExercise(item.id);
            bumpData();
            onChanged();
          }}
        >
          <TrashIcon size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      <TargetsEditor
        value={item.targets}
        kind={item.exerciseKind}
        figureSlug={artSlugFor(item.exerciseName)}
        onCommit={commit}
        resetKey={weekStart}
      />
    </Card>
  );
}

/** O rotulo do dia, gravado depois que a mao para — como os steppers. */
function DayNameInput({ routineId, value }: { routineId: string; value: string }) {
  const [name, setName] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(name);
  latest.current = name;

  useEffect(() => {
    if (dirty.current) return;
    setName(value);
  }, [value]);

  const commit = useCallback(() => {
    dirty.current = false;
    timer.current = null;
    updateRoutine(routineId, { name: latest.current }).then(bumpData);
  }, [routineId]);

  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      commit();
    },
    [commit],
  );

  return (
    <TextInput
      style={styles.input}
      value={name}
      onChangeText={(text) => {
        setName(text);
        dirty.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(commit, NAME_COMMIT_DELAY);
      }}
      placeholder="Costas + bíceps"
      placeholderTextColor={colors.textSecondary}
      returnKeyType="done"
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  input: {
    marginTop: spacing.sm,
    fontFamily: 'Inter_400Regular',
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  weekNav: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  weekText: {
    flex: 1,
    alignItems: 'center',
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  itemText: {
    flex: 1,
  },
  empty: {
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
  },
});

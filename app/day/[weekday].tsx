import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LayoutAnimationConfig, useAnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addExerciseToRoutine,
  createExercise,
  ensureDayRoutine,
  ensureRunExercise,
  listExercises,
  removeRoutineExercise,
  reorderRoutineExercises,
  setWeekTarget,
  targetsForWeek,
  updateRoutine,
  type TargetSource,
  type WeekExercise,
} from '@/db/repo';
import { applyOrder } from '@/domain/order';
import type { Targets, Weekday } from '@/domain/types';
import { addWeeks, everyWeekday, weekRangeLabel, weekStartKey, weekdayName, weeksBetween } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, hitSlop, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { artSlugFor } from '@/movements/library';
import { DEFAULT_RUN_TARGETS, DEFAULT_TARGETS, ExercisePicker } from '@/ui/ExercisePicker';
import { FloatingGlassButton } from '@/ui/FloatingGlassButton';
import { Reveal } from '@/ui/Reveal';
import { ReorderableList } from '@/ui/ReorderableList';
import { EmptyState } from '@/ui/EmptyState';
import { LoadError } from '@/ui/LoadError';
import { Header, RoundButton, Screen } from '@/ui/Screen';
import { TargetsEditor } from '@/ui/TargetsEditor';
import { Body, Label, Meta } from '@/ui/Text';
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '@/ui/icons';

/** Tempo de mao parada antes de gravar o rotulo do dia. */
const NAME_COMMIT_DELAY = 400;

/**
 * De onde veio o numero que esta na tela. Sem isso o usuario nao sabe se o
 * valor e uma escolha dele ou uma heranca do historico.
 *
 * Mesmo vocabulario do `SOURCE_LABEL` da tela de treino, de proposito: e o
 * mesmo conceito nas duas, e nomea-lo diferente faria parecer coisas
 * diferentes. O "nesta semana" saiu do `override` porque a navegacao por semana
 * no cabecalho ja da esse contexto.
 */
const SOURCE_LABEL: Record<TargetSource, string> = {
  override: 'editado por você',
  lastActual: 'igual à última vez',
  plan: 'do seu plano',
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
  const insets = useSafeAreaInsets();

  const weekday = Number(params.weekday) as Weekday;
  const [weekStart, setWeekStart] = useState(() => weekStartKey(new Date()));
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState<WeekExercise | null>(null);

  const { data, loading, error, reload } = useQuery(
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

  // O que acabou de ser arrastado, na frente do banco ate a recarga chegar —
  // sem isso o card voltaria ao lugar antigo por um quadro depois do drop.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const reorder = useCallback(
    (ids: string[]) => {
      setLocalOrder(ids);
      void reorderRoutineExercises(ids).then(() => {
        bumpData();
        reload();
      });
    },
    [reload],
  );

  const loaded = data?.items;
  const ordered = useMemo(
    () => (loaded && localOrder ? applyOrder(loaded, localOrder, routineExerciseKey) : loaded),
    [loaded, localOrder],
  );

  if (error) {
    return (
      <Screen>
        <Header title={weekdayName(weekday)} back />
        <LoadError error={error} onRetry={reload} />
      </Screen>
    );
  }

  if (loading || !data) {
    return (
      <Screen>
        <Header title={weekdayName(weekday)} back />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { routine, catalog } = data;
  const items = ordered ?? data.items;
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
    // O botao vai por `overlay`, e nao entre os filhos: ele e vidro, e vidro
    // dentro do alvo de blur se leria a si mesmo. Ver `Screen`.
    <Screen
      overlay={
        // Com a lista vazia o botao de adicionar mora no proprio vazio; dois
        // "Adicionar exercicio" na mesma tela seriam uma pergunta sem resposta.
        items.length > 0 ? (
          <FloatingGlassButton
            label="Adicionar exercício"
            onPress={() => setPicking(true)}
            bottom={insets.bottom + spacing.xl}
          />
        ) : null
      }
    >
      <Header title={weekdayName(weekday)} back />

      {/* O `Header` fica fora do fade: ele ja estava na tela durante o
          carregamento. So o conteudo, que ate agora era um spinner, entra. */}
      <Reveal style={styles.reveal}>
      {/* `skipEntering` so vale para a PRIMEIRA renderizacao: sem ele a lista
          inteira entraria em cascata toda vez que a tela abre. Trocar de semana
          nao remonta os itens — a `key` e o id do routine_exercise, que nao
          muda com a semana —, entao a navegacao por semana nao dispara entrada. */}
      <LayoutAnimationConfig skipEntering>
      <Animated.ScrollView
        ref={scrollRef}
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

        {items.length > 0 ? (
          <ReorderableList
            data={items}
            keyOf={routineExerciseKey}
            onReorder={reorder}
            scrollableRef={scrollRef}
            gap={spacing.lg}
            renderItem={(item) => (
              <ExerciseCard item={item} weekStart={weekStart} onRemove={setRemoving} />
            )}
          />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="Dia de descanso"
            message={`Nenhum exercício ${everyWeekday(weekday)}. Adicione um para montar o treino.`}
            action={{ label: 'Adicionar exercício', onPress: () => setPicking(true) }}
          />
        ) : null}
      </Animated.ScrollView>
      </LayoutAnimationConfig>
      </Reveal>

      <ConfirmModal
        visible={removing != null}
        title={`Remover ${removing?.exerciseName ?? ''} do plano?`}
        message={`Sai de ${everyWeekday(weekday)} a partir de agora. O que já foi registrado continua no histórico.`}
        cancelLabel="Cancelar"
        confirmLabel="Remover"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          void removeRoutineExercise(removing.id).then(() => {
            bumpData();
            reload();
          });
        }}
      />

      <ExercisePicker
        visible={picking}
        catalog={catalog}
        usedIds={used}
        subtitle={`Passa a valer ${everyWeekday(weekday)}`}
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

/** A ordem do plano e a dos routine_exercises. */
function routineExerciseKey(item: WeekExercise): string {
  return item.id;
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
 *
 * `memo` porque a lista re-renderiza inteira ao pegar e ao soltar um card no
 * arraste (`ReorderableList` guarda qual esta levantado), e cada card carrega
 * steppers e a figura do movimento. Por isso `onRemove` recebe o item em vez de
 * vir embrulhado numa closure nova a cada render.
 */
const ExerciseCard = memo(function ExerciseCard({
  item,
  weekStart,
  onRemove,
}: {
  item: WeekExercise;
  weekStart: string;
  /** Abre a pergunta; remover do plano nunca e a um toque. */
  onRemove: (item: WeekExercise) => void;
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
          onPress={() => onRemove(item)}
          accessibilityLabel={`Remover ${item.exerciseName} do plano`}
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
});

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
  // Estica igual ao que o `Reveal` embrulha — sem isto o scroll fica sem altura.
  reveal: { flex: 1 },
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
});

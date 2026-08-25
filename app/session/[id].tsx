import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addExerciseToRoutine,
  createExercise,
  getSession,
  listExercises,
  listSessionSets,
  removeRoutineExercise,
  setSessionExerciseTargets,
  targetsForWeek,
  type WeekExercise,
} from '@/db/repo';
import type { ExerciseKind, SessionSet, Targets } from '@/domain/types';
import { formatDistance, formatDuration, runTargetsFromSets } from '@/domain/run';
import { targetsFromSets } from '@/domain/targets';
import { formatVolume, formatWeight, totalVolume } from '@/domain/volume';
import { fromDateKey, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { useAuth } from '@/sync/auth';
import { accentGlow, colors, fontSize, hitSlop, radius, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { artSlugFor } from '@/movements/library';
import { DEFAULT_RUN_TARGETS, DEFAULT_TARGETS, ExercisePicker } from '@/ui/ExercisePicker';
import { shortDate } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { TargetsEditor } from '@/ui/TargetsEditor';
import { Body, Label, Meta } from '@/ui/Text';
import { ArrowDownIcon, CheckIcon, PlusIcon, TrashIcon } from '@/ui/icons';

/**
 * Registro do treino de um dia.
 *
 * O modelo e por exercicio, nao por serie: o usuario diz "3 x 10 a 60 kg" e
 * pronto. E a mesma mecanica da tela do dia em Ajustes — os mesmos steppers, o
 * mesmo debounce — so que o destino da escrita e a sessao daquela data, e nao
 * os alvos da semana.
 *
 * Nada aqui precisa ser "finalizado". Cada exercicio grava sozinho quando a mao
 * para, e o numero do topo — o peso agregado do dia — atualiza junto.
 */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, loading, reload } = useQuery(useCallback(() => loadSession(id), [id]));

  const [picking, setPicking] = useState(false);

  // Sair da tela e o melhor momento para tentar subir: o treino acabou de ser
  // registrado e normalmente o usuario ja saiu da area morta da academia. Se
  // falhar, a outbox segura.
  useEffect(() => () => void useAuth.getState().runSync(), []);

  if (loading || !data?.session) {
    return (
      <Screen>
        <Header
          title="Treino"
          action={{ icon: <ArrowDownIcon size={20} />, onPress: () => router.back() }}
        />
        <ActivityIndicator color={colors.textSecondary} />
      </Screen>
    );
  }

  const { session, items, catalog, routineId, volume } = data;
  const date = fromDateKey(session.date);
  const used = new Set(items.map((item) => item.exerciseId));
  const doneCount = items.filter((item) => item.done).length;

  /**
   * Adicionar aqui e recorrente por padrao: o exercicio entra na rotina daquele
   * dia da semana, entao aparece neste treino E em todo dia igual daqui pra
   * frente. E o mesmo contrato da tela do dia — por isso o mesmo subtitulo.
   */
  const addExercise = async (exerciseId: string) => {
    if (!routineId) return;
    const picked = catalog.find((exercise) => exercise.id === exerciseId);
    await addExerciseToRoutine(
      routineId,
      exerciseId,
      picked?.kind === 'run' ? DEFAULT_RUN_TARGETS : DEFAULT_TARGETS,
    );
    bumpData();
    setPicking(false);
    reload();
  };

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
            {`${weekdayName(weekdayOf(date))} · ${shortDate(date)} · ${doneCount} de ${items.length} concluídos`}
          </Meta>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        // Sem isto, com o teclado do peso aberto, o primeiro toque em qualquer
        // outro lugar so fecha o teclado e se perde.
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {items.map((item) => (
          <ExerciseCard key={item.id} item={item} sessionId={session.id} />
        ))}

        {items.length === 0 ? (
          <Meta style={styles.empty}>Nenhum exercício neste dia ainda.</Meta>
        ) : null}

        {routineId ? (
          <Pressable style={styles.addExercise} onPress={() => setPicking(true)}>
            <PlusIcon size={16} color={colors.textPrimary} />
            <View style={styles.addExerciseText}>
              <Body>Adicionar exercício</Body>
              <Meta>{`entra também toda ${weekdayName(weekdayOf(date)).toLowerCase()}`}</Meta>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>

      <ExercisePicker
        visible={picking}
        catalog={catalog}
        usedIds={used}
        subtitle={`Passa a valer toda ${weekdayName(weekdayOf(date)).toLowerCase()}`}
        onClose={() => setPicking(false)}
        onPick={addExercise}
        onCreate={async (name, muscleGroup, kind) => {
          const exercise = await createExercise(name, muscleGroup, kind);
          await addExercise(exercise.id);
        }}
      />
    </Screen>
  );
}

/**
 * De onde vieram os numeros que estao na tela.
 *
 * Nao diz se o exercicio foi feito — isso e o `done`, e quem responde por ele e
 * a caixa de marcar. Um exercicio pode ter numeros ajustados e ainda nao ter
 * sido levantado.
 */
const SOURCE_LABEL: Record<ItemSource, string> = {
  edited: 'ajustado neste treino',
  lastActual: 'como na última vez',
  plan: 'ainda não treinado',
};

type ItemSource = 'edited' | 'lastActual' | 'plan';

type SessionExercise = {
  /** O id do `routine_exercise`, ou o do exercicio quando ele nao esta na rotina. */
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseKind: ExerciseKind;
  targets: Targets;
  /** Marcado como feito: e o que entra no peso levantado do dia. */
  done: boolean;
  source: ItemSource;
  /** Um exercicio so sai da rotina se estiver nela. */
  routineExerciseId: string | null;
};

/**
 * Um exercicio do treino: os numeros, e a caixa que decide se eles contam.
 *
 * Mexer no stepper NAO grava. Antes gravava, e isso confundia duas perguntas
 * diferentes: "quanto e" e "eu fiz". Corrigir a carga de um exercicio que o
 * usuario acabou desistindo de fazer somava peso que ninguem levantou. Aqui o
 * stepper so mexe no rascunho local; quem escreve no banco e a caixa.
 *
 * O rascunho comeca no que veio do banco e NAO e re-sincronizado depois, de
 * proposito. A tela recarrega inteira a cada `bumpData` — inclusive por um sync
 * que chegou de outro aparelho — e aceitar o valor do banco nessas recargas
 * apagaria um ajuste que o usuario fez e ainda nao marcou. Ficar "atrasado" em
 * relacao ao banco nao e problema aqui: toda escrita desta tela passa por
 * `write`, que manda justamente este rascunho, entao os dois so divergem
 * enquanto o exercicio esta desmarcado — que e exatamente quando o rascunho e
 * a verdade.
 */
function ExerciseCard({ item, sessionId }: { item: SessionExercise; sessionId: string }) {
  const [targets, setTargets] = useState(item.targets);

  // Grava o exercicio inteiro com o estado da caixa. `bumpData` recarrega esta
  // tela junto com as outras — e o que faz o peso do topo, o card da home e o
  // dot-matrix acompanharem o toque.
  const write = (next: Targets, done: boolean) => {
    setSessionExerciseTargets(sessionId, item.exerciseId, item.exerciseKind, next, done)
      .then(bumpData)
      // Sem isto uma falha de escrita sumia sem deixar rastro: a tela nao
      // recarregava e o usuario via a caixa nao reagir, sem nada em lugar nenhum
      // dizendo por que.
      .catch((error) => {
        console.warn('[CleanGym] falha ao gravar', item.exerciseName, error);
      });
  };

  const toggle = () => {
    // Marcar leva junto o que estiver no stepper agora, inclusive um ajuste que
    // o usuario acabou de fazer e nunca foi ao banco.
    write(targets, !item.done);
  };

  return (
    <Card>
      <View style={styles.itemHead}>
        <View style={styles.itemText}>
          <Body numberOfLines={1}>{item.exerciseName}</Body>
          <Meta>
            {`${item.done ? 'concluído' : SOURCE_LABEL[item.source]} · ${summary(item.exerciseKind, targets)}`}
          </Meta>
        </View>

        {item.routineExerciseId ? (
          <Pressable
            hitSlop={hitSlop}
            onPress={async () => {
              await removeRoutineExercise(item.routineExerciseId!);
              // Zera o que estava gravado: o exercicio saiu do dia, e deixar as
              // series vivas manteria o volume de um movimento que nao esta
              // mais na lista. `sets: 0` nao insere linha nenhuma, entao o
              // `done` daqui e indiferente.
              await setSessionExerciseTargets(
                sessionId,
                item.exerciseId,
                item.exerciseKind,
                { sets: 0, reps: 0, weightKg: 0, distanceKm: 0, durationMin: 0 },
                false,
              );
              bumpData();
            }}
          >
            <TrashIcon size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <Pressable
          hitSlop={hitSlop}
          onPress={toggle}
          // O glow precisa de um wrapper proprio, pelo mesmo motivo do `Card`:
          // `overflow: hidden` na forma recortaria a sombra junto.
          style={item.done ? styles.checkGlow : undefined}
        >
          <View style={[styles.check, item.done && styles.checkDone]}>
            {item.done ? <CheckIcon size={15} color={colors.bg} /> : null}
          </View>
        </Pressable>
      </View>

      <TargetsEditor
        value={targets}
        kind={item.exerciseKind}
        figureSlug={artSlugFor(item.exerciseName)}
        onCommit={(next) => {
          setTargets(next);
          // Ja marcado: o numero novo tem que valer na hora, senao o peso do dia
          // ficaria com a carga antiga ate o usuario desmarcar e marcar de novo.
          if (item.done) write(next, true);
        }}
        resetKey={`${sessionId}:${item.exerciseId}`}
      />
    </Card>
  );
}

/** "3 × 10 · 62,5 kg · 1.875 kg" ou "5 km · 28 min" — o que a linha vale. */
function summary(kind: ExerciseKind, targets: Targets): string {
  const { sets, reps, weightKg, distanceKm, durationMin } = targets;

  if (kind === 'run') {
    return `${formatDistance(distanceKm)} km · ${formatDuration(durationMin)}`;
  }

  const base = `${sets} × ${reps} · ${formatWeight(weightKg)} kg`;
  return `${base} · ${formatVolume(sets * reps * weightKg)} kg`;
}

/**
 * O que a tela mostra: o plano da semana daquela data, com o que ja foi
 * registrado por cima.
 *
 * A ordem importa. O plano vem de `targetsForWeek`, que ja resolve a cascata
 * (ajuste da semana → ultima vez treinado → semente); o que esta gravado NESTA
 * sessao ganha de todos eles, porque e o unico que descreve o dia em questao e
 * nao uma previsao dele.
 *
 * Exercicio registrado que nao esta mais na rotina continua aparecendo, no fim
 * da lista: tirar o movimento do dia nao pode sumir com o que ja foi levantado.
 */
async function loadSession(id: string) {
  const session = await getSession(id);
  if (!session) return { session: null } as const;

  const [sets, catalog, planned] = await Promise.all([
    listSessionSets(id),
    listExercises(),
    session.routineId
      ? targetsForWeek(weekStartKey(fromDateKey(session.date)), session.routineId)
      : Promise.resolve<WeekExercise[]>([]),
  ]);

  const recorded = recordedByExercise(sets, catalog);
  const items: SessionExercise[] = [];

  for (const item of planned) {
    const entry = recorded.get(item.exerciseId) ?? null;
    items.push({
      id: item.id,
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      exerciseKind: item.exerciseKind,
      // Numero gravado ganha do herdado mesmo desmarcado: e o ajuste que o
      // usuario fez neste dia, e perde-lo ao sair da tela seria pior que
      // mostra-lo sem contar no volume.
      targets: entry?.targets ?? item.targets,
      done: entry?.done ?? false,
      source: entry ? 'edited' : item.source === 'plan' ? 'plan' : 'lastActual',
      routineExerciseId: item.id,
    });
  }

  const inPlan = new Set(planned.map((item) => item.exerciseId));
  for (const [exerciseId, entry] of recorded) {
    if (inPlan.has(exerciseId)) continue;
    const exercise = catalog.find((candidate) => candidate.id === exerciseId);
    items.push({
      id: exerciseId,
      exerciseId,
      exerciseName: exercise?.name ?? 'Exercício',
      exerciseKind: exercise?.kind ?? 'strength',
      targets: entry.targets,
      done: entry.done,
      source: 'edited',
      routineExerciseId: null,
    });
  }

  return {
    session,
    items,
    catalog,
    routineId: session.routineId,
    volume: totalVolume(sets),
  };
}

/** O que ja existe no banco para um exercicio deste treino. */
type Recorded = { targets: Targets; done: boolean };

/**
 * Os numeros ja gravados, um por exercicio, marcados ou nao.
 *
 * Olha tambem as linhas com `done = 0`, ao contrario do resto do app: elas sao
 * exatamente o exercicio que o usuario ajustou mas ainda nao marcou como feito,
 * e a tela precisa mostrar o numero dele. Quem filtra por `done` e o volume,
 * nao esta leitura.
 *
 * As linhas de um exercicio nascem sempre uniformes — `setSessionExerciseTargets`
 * substitui o exercicio inteiro a cada escrita — entao ler o `done` da primeira
 * vale para o grupo.
 *
 * A derivacao dos numeros reusa as duas regras do resto do app: corrida soma as
 * linhas, carga pega a ultima serie e conta quantas foram. As duas exigem
 * `done`, por isso o `done: true` forcado abaixo — aqui a pergunta e "que
 * numeros sao esses", nao "isso foi levantado".
 */
function recordedByExercise(
  sets: readonly SessionSet[],
  catalog: readonly { id: string; kind: ExerciseKind }[],
): Map<string, Recorded> {
  const kinds = new Map(catalog.map((exercise) => [exercise.id, exercise.kind]));
  const buckets = new Map<string, SessionSet[]>();

  for (const set of sets) {
    const bucket = buckets.get(set.exerciseId);
    if (bucket) bucket.push(set);
    else buckets.set(set.exerciseId, [set]);
  }

  const result = new Map<string, Recorded>();
  for (const [exerciseId, bucket] of buckets) {
    const targets =
      kinds.get(exerciseId) === 'run'
        ? runTargetsFromSets(bucket.map((set) => ({ ...set, done: true })))
        : targetsFromSets(
            bucket.map((set) => ({
              setIndex: set.setIndex,
              reps: set.reps,
              weightKg: set.weightKg,
            })),
          );
    if (targets) result.set(exerciseId, { targets, done: bucket.some((set) => set.done) });
  }
  return result;
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
  list: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  itemHead: {
    flexDirection: 'row',
    // Centralizado, nao alinhado ao topo: a caixa e um alvo de toque e precisa
    // ficar no eixo do bloco de texto, nao pendurada na primeira linha dele.
    alignItems: 'center',
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
  /**
   * Quadrado de cantos arredondados, nao circulo: e a mesma forma do dia do
   * calendario, e o app so tem uma linguagem para "celula marcavel". Circulo
   * aqui abriria uma segunda.
   */
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.square,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dotEmpty,
  },
  /**
   * Marcado: laranja solido. Sao varias caixas accent na mesma tela, o que a
   * regra geral proibe — e a unica excecao do brief, documentada em
   * `Design/design.md` §2 ("A unica excecao: a caixa de concluido"). Em resumo:
   * aqui a cor nao destaca um exercicio entre os outros, marca um estado
   * binario que se repete, e a leitura util e a agregada — quanto do treino ja
   * foi feito, de relance.
   *
   * O preco da excecao e que NENHUM outro elemento desta tela pode usar accent.
   */
  checkDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  /** O brilho que faz o laranja ler como neon, igual ao do card accent. */
  checkGlow: {
    borderRadius: radius.square,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: accentGlow.opacity,
    shadowRadius: accentGlow.radius,
    // Brilho para todo lado, nao sombra projetada: offset zero.
    shadowOffset: { width: 0, height: 0 },
    elevation: accentGlow.elevation,
  },
});

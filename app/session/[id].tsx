import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addExerciseToRoutine,
  addSet,
  createExercise,
  getSession,
  listExercises,
  listSessionSets,
  removeRoutineExercise,
  removeSet,
  setSessionExerciseSets,
  setSessionExerciseTargets,
  targetsForWeek,
  updateSet,
  type WeekExercise,
} from '@/db/repo';
import type { ExerciseKind, SessionSet, Targets } from '@/domain/types';
import { formatDistance, formatDuration, runTargetsFromSets } from '@/domain/run';
import { type SetDraft, summarizeSets } from '@/domain/sets';
import { targetsFromSets } from '@/domain/targets';
import { formatVolume, formatWeight, totalVolume } from '@/domain/volume';
import { fromDateKey, weekStartKey, weekdayName, weekdayOf } from '@/domain/week';
import { bumpData, useQuery } from '@/store/data';
import { useAuth } from '@/sync/auth';
import { colors, fontSize, hitSlop, radius, spacing } from '@/theme/tokens';
import { useListMotion } from '@/ui/motion';
import { confirm } from '@/ui/haptics';
import { Card } from '@/ui/Card';
import { CheckCell } from '@/ui/CheckCell';
import { CountingStat } from '@/ui/CountingStat';
import { artSlugFor } from '@/movements/library';
import { DEFAULT_RUN_TARGETS, DEFAULT_TARGETS, ExercisePicker } from '@/ui/ExercisePicker';
import { shortDate } from '@/ui/relative';
import { Header, Screen } from '@/ui/Screen';
import { SetRow } from '@/ui/SetRow';
import { COMMIT_DELAY, TargetsEditor } from '@/ui/TargetsEditor';
import { Body, Label, Meta } from '@/ui/Text';
import { ArrowDownIcon, PlusIcon, TrashIcon } from '@/ui/icons';

/**
 * Registro do treino de um dia.
 *
 * Musculacao e por serie: cada serie tem reps e carga proprios, para comportar
 * rampa de aquecimento ou carga que varia ao longo do exercicio. O card comeca
 * fechado, mostrando so o resumo; tocar no nome do exercicio expande e revela
 * a lista de series, cada uma com seu proprio par de steppers.
 *
 * Corrida continua por exercicio inteiro, sem expandir: distancia e tempo nao
 * fazem sentido fatiados em "serie", e a mecanica antiga — os mesmos steppers
 * empilhados da tela do dia em Ajustes, o mesmo debounce — segue valendo para
 * ela sem mudanca (ver `RunExerciseCard`).
 *
 * Nada aqui precisa ser "finalizado". Cada exercicio grava sozinho quando a mao
 * para, e o numero do topo — o peso agregado do dia — atualiza junto.
 */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, loading, reload } = useQuery(useCallback(() => loadSession(id), [id]));

  /**
   * O volume tem consulta PROPRIA, separada de `loadSession`.
   *
   * `loadSession` espera `targetsForWeek`, que resolve os alvos de cada
   * exercicio (ver `src/db/repo.ts` — hoje em paralelo, ja foi um `for` com
   * `await lastPerformedTargets(...)` em serie) — e o que monta a lista da
   * tela, mas continua mais pesado que a contagem do volume, que so precisa
   * somar `session_sets`. Separado, o numero do topo chega (e a contagem
   * comeca) assim que ESTA consulta, bem mais leve, resolver — sem esperar o
   * reload pesado da lista.
   *
   * A contagem em si mora no `CountingStat`, la embaixo: `useCountUp` faz um
   * `setState` por quadro, e chamado AQUI ele re-renderizava a tela inteira
   * umas 40 vezes em 700ms. Ver o cabecalho daquele arquivo.
   *
   * PROBLEMA CONHECIDO, AINDA ABERTO: marcar uma caixa aqui continua
   * respondendo devagar (visual + haptico) em testes no dev-client via
   * tunel, mesmo depois de duas correcoes (`targetsForWeek` em paralelo, e
   * `useQuery` parando de recarregar abas fora de foco — ambas em
   * `src/store/data.ts`/`src/db/repo.ts`). `write()`/`toggle()` ja sao
   * otimistas (`setDone` antes do `await`) e `confirm()` nunca espera a
   * escrita, entao o atraso nao deveria vir daqui. Suspeitas nao descartadas:
   * (1) parte e overhead normal de dev mode + Metro por tunel (JS
   * nao-otimizado, sem bytecode do Hermes de producao) — vale medir numa
   * build de release antes de investigar mais fundo; (2) pode haver outro
   * N+1 sequencial em algum caminho de escrita (`setSessionExerciseSets`,
   * `updateSet`) que ainda nao foi auditado como `targetsForWeek` foi.
   */
  const { data: sessionVolume } = useQuery(
    useCallback(() => listSessionSets(id).then(totalVolume), [id]),
  );

  const [picking, setPicking] = useState(false);
  const listMotion = useListMotion();

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

  const { session, items, catalog, routineId } = data;
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
        <CountingStat kg={sessionVolume ?? undefined} size={fontSize.numberLg} />
        <View style={styles.summaryMeta}>
          <Label>Volume levantado</Label>
          <Meta>
            {`${weekdayName(weekdayOf(date))} · ${shortDate(date)} · ${doneCount} de ${items.length} concluídos`}
          </Meta>
        </View>
      </View>

      {/* `skipEntering` so vale para a PRIMEIRA renderizacao: sem ele a lista
          inteira entraria em cascata toda vez que a tela abre ou que o
          `useQuery` troca o placeholder pelos dados — que e a animacao de
          "tudo que entra na tela" que ficou deliberadamente de fora. */}
      <LayoutAnimationConfig skipEntering>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        // Sem isto, com o teclado do peso aberto, o primeiro toque em qualquer
        // outro lugar so fecha o teclado e se perde.
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {items.map((item) => (
          <Animated.View key={item.id} {...listMotion}>
            <ExerciseCard item={item} sessionId={session.id} />
          </Animated.View>
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
      </LayoutAnimationConfig>

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
 *
 * **Todos tem que caber na mesma linha que "concluído", e num comprimento
 * parecido.** Marcar troca este rotulo, e a versao anterior ia de 18-21
 * caracteres ("ajustado neste treino") para 9: a linha mudava de quebra e o
 * card inteiro pulava de altura no momento do toque. Sao rotulos de fonte do
 * dado, nao frases — o §8 do brief ja pedia substantivo + dado.
 */
const SOURCE_LABEL: Record<ItemSource, string> = {
  edited: 'ajustado',
  lastActual: 'última vez',
  plan: 'do plano',
};

type ItemSource = 'edited' | 'lastActual' | 'plan';

type SessionExercise = {
  /** O id do `routine_exercise`, ou o do exercicio quando ele nao esta na rotina. */
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseKind: ExerciseKind;
  targets: Targets;
  /**
   * As series do exercicio, uma por linha — vazio na corrida, que nao usa o
   * editor por serie. `id: null` numa linha significa que ela ainda nao existe
   * no banco (nada foi gravado nesta sessao; a linha e sintetica, a partir do
   * plano). Ver `rowsForExercise`.
   */
  rows: SetDraft[];
  /** Marcado como feito: e o que entra no peso levantado do dia. */
  done: boolean;
  source: ItemSource;
  /** Um exercicio so sai da rotina se estiver nela. */
  routineExerciseId: string | null;
};

/**
 * Um exercicio do treino: os numeros, e a caixa que decide se eles contam.
 *
 * So decide o roteamento por `kind` — a mecanica de musculacao (series
 * independentes, card que expande) e a de corrida (um alvo so, sem expandir)
 * divergem demais para caber no mesmo corpo de funcao sem um `if` a cada
 * linha. A mesma divisao que `TargetsEditor` ja faz internamente.
 *
 * `memo` aqui e defensivo, nao otimizacao especulativa: cada card carrega a
 * arte do movimento e uma lista de series com estado proprio, e qualquer
 * `setState` na raiz desta tela redesenharia todos eles. `item` so troca de
 * identidade quando `loadSession` recarrega — ou seja, quando os dados
 * mudaram de verdade —, entao a comparacao rasa do `memo` e exatamente a
 * pergunta certa.
 */
const ExerciseCard = memo(function ExerciseCard({
  item,
  sessionId,
}: {
  item: SessionExercise;
  sessionId: string;
}) {
  return item.exerciseKind === 'run' ? (
    <RunExerciseCard item={item} sessionId={sessionId} />
  ) : (
    <StrengthExerciseCard item={item} sessionId={sessionId} />
  );
});

/**
 * O exercicio saiu do dia: some da rotina, e o que estava gravado nesta sessao
 * zera junto.
 *
 * Zerar em vez de so tirar da rotina importa: deixar as series vivas manteria
 * o volume de um movimento que nao esta mais na lista. `sets: 0` nao insere
 * linha nenhuma, entao o `done` daqui e indiferente. Compartilhado pelos dois
 * tipos de card porque a regra nao muda com `kind` — so o formato das series
 * gravadas muda.
 */
async function removeFromToday(sessionId: string, item: SessionExercise): Promise<void> {
  await removeRoutineExercise(item.routineExerciseId!);
  await setSessionExerciseTargets(
    sessionId,
    item.exerciseId,
    item.exerciseKind,
    { sets: 0, reps: 0, weightKg: 0, distanceKm: 0, durationMin: 0 },
    false,
  );
  bumpData();
}

/**
 * Corrida: exatamente a mecanica de antes de existir edicao por serie — um
 * alvo so (distancia/tempo), `TargetsEditor` sempre visivel, sem expandir.
 * Fatiar corrida em "serie" nao faz sentido (ver `run.ts`), entao ela nao
 * ganha o card novo.
 */
function RunExerciseCard({ item, sessionId }: { item: SessionExercise; sessionId: string }) {
  const [targets, setTargets] = useState(item.targets);

  /**
   * A caixa e otimista: ela responde ao dedo, nao ao banco.
   *
   * Antes ela era desenhada direto de `item.done`, e por isso o toque so
   * aparecia depois de uma volta inteira — escrita assincrona no SQLite,
   * `bumpData`, TODA tela montada refazendo sua consulta, e so entao o novo
   * `item.done` chegando aqui. O atraso era visivel a olho nu: dava para clicar
   * e esperar a caixa preencher.
   *
   * E a mesma ideia que o rascunho de `targets` logo acima ja usava; a caixa
   * tinha ficado de fora. A diferenca e que aqui a divergencia com o banco dura
   * so o tempo da escrita, e uma falha desfaz (ver o `catch` em `write`).
   */
  const [done, setDone] = useState(item.done);

  /**
   * Aceita o valor do banco de volta — mas nunca com uma escrita nossa em voo.
   *
   * Sem a guarda, qualquer `bumpData` disparado por OUTRA tela no meio da nossa
   * escrita traria o `item.done` velho e a caixa piscaria de volta para o
   * estado anterior. Com ela, o unico caminho que reverte a caixa e a falha.
   */
  const writing = useRef(false);

  useEffect(() => {
    if (writing.current) return;
    setDone(item.done);
  }, [item.done]);

  // Grava o exercicio inteiro com o estado da caixa. `bumpData` recarrega esta
  // tela junto com as outras — e o que faz o peso do topo, o card da home e o
  // dot-matrix acompanharem o toque. Esses agregados continuam esperando o
  // banco de proposito: eles relatam o que ficou gravado, nao a intencao.
  const write = (next: Targets, nextDone: boolean) => {
    setDone(nextDone);
    writing.current = true;

    setSessionExerciseTargets(sessionId, item.exerciseId, item.exerciseKind, next, nextDone)
      .then(bumpData)
      // Sem isto uma falha de escrita sumia sem deixar rastro: a tela nao
      // recarregava e o usuario via a caixa nao reagir, sem nada em lugar nenhum
      // dizendo por que. Agora ela tambem desfaz o otimismo — do contrario a
      // caixa ficaria marcada mentindo sobre um treino que nao foi gravado.
      .catch((error) => {
        setDone(!nextDone);
        console.warn('[CleanGym] falha ao gravar', item.exerciseName, error);
      })
      .finally(() => {
        writing.current = false;
      });
  };

  const toggle = () => {
    // O haptico fica AQUI e nao em `write`: o stepper tambem chama `write` (para
    // um exercicio ja marcado), e vibrar ali dispararia dezenas de pulsos por
    // exercicio. Confirmacao e o gesto da caixa, nao toda escrita.
    confirm();
    // Marcar leva junto o que estiver no stepper agora, inclusive um ajuste que
    // o usuario acabou de fazer e nunca foi ao banco.
    write(targets, !done);
  };

  return (
    <Card>
      <View style={[styles.itemHead, styles.itemHeadSpaced]}>
        <View style={styles.itemText}>
          <Body numberOfLines={1}>{item.exerciseName}</Body>
          {/* Uma linha, sempre. Encurtar os rotulos torna a quebra improvavel;
              isto a torna impossivel — o card nao pode mudar de altura no
              toque, e nome de exercicio e alvo variam livremente. */}
          <Meta numberOfLines={1}>
            {`${done ? 'concluído' : SOURCE_LABEL[item.source]} · ${runSummary(targets)}`}
          </Meta>
        </View>

        {item.routineExerciseId ? (
          <Pressable hitSlop={hitSlop} onPress={() => void removeFromToday(sessionId, item)}>
            <TrashIcon size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <CheckCell checked={done} onPress={toggle} />
      </View>

      <TargetsEditor
        value={targets}
        kind="run"
        figureSlug={artSlugFor(item.exerciseName)}
        onCommit={(next) => {
          setTargets(next);
          // Ja marcado: o numero novo tem que valer na hora, senao o peso do dia
          // ficaria com a carga antiga ate o usuario desmarcar e marcar de novo.
          if (done) write(next, true);
        }}
        resetKey={`${sessionId}:${item.exerciseId}`}
      />
    </Card>
  );
}

/**
 * Musculacao: series independentes, cada uma com reps e carga proprios.
 *
 * O card comeca fechado — so o resumo (`strengthSummary`) na linha de baixo do
 * nome. Tocar no nome expande e revela uma `SetRow` por serie.
 *
 * O rascunho de `rows` segue a MESMA regra que `targets` seguia no card
 * antigo: comeca no que veio do banco e nunca e re-sincronizado depois disso,
 * de proposito (ver o comentario original, hoje em `RunExerciseCard`) — editar
 * uma serie so mexe no rascunho local ate o exercicio ser marcado concluido.
 *
 * A diferenca de granularidade: la, toda edicao reescrevia o exercicio
 * inteiro (`write`, sempre); aqui, so o TOGGLE e o add/remove de serie
 * reescrevem tudo — uma edicao de reps/peso numa serie ja concluida grava so
 * aquela linha (`scheduleRowCommit`, via `updateSet`), para nao pagar o custo
 * de apagar e reinserir N linhas a cada toque num peso so.
 */
function StrengthExerciseCard({ item, sessionId }: { item: SessionExercise; sessionId: string }) {
  const [rows, setRows] = useState<SetDraft[]>(item.rows);
  const [done, setDone] = useState(item.done);
  const [expanded, setExpanded] = useState(false);

  // Mesma guarda de `RunExerciseCard.writing`, generalizada para contador: o
  // toggle, uma edicao de serie e um add/remove de serie podem estar em voo ao
  // mesmo tempo, e so quando NENHUM deles esta e que aceitamos `item.done` de
  // volta.
  const writingCount = useRef(0);
  const rowTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingPatches = useRef(new Map<string, Partial<Pick<SetDraft, 'reps' | 'weightKg'>>>());

  useEffect(() => {
    if (writingCount.current === 0) setDone(item.done);
  }, [item.done]);

  const commitRowNow = (id: string, patch: Partial<Pick<SetDraft, 'reps' | 'weightKg'>>) => {
    writingCount.current += 1;
    updateSet(id, patch)
      .then(bumpData)
      .catch((error) => console.warn('[CleanGym] falha ao gravar série', item.exerciseName, error))
      .finally(() => {
        writingCount.current -= 1;
      });
  };

  // Debounce por serie, mesmo numero (`COMMIT_DELAY`) e mesma razao do
  // `TargetsEditor`: curto o bastante para nao se perder ao sair da tela,
  // longo o bastante para tres toques seguidos virarem uma escrita so.
  const scheduleRowCommit = (id: string, patch: Partial<Pick<SetDraft, 'reps' | 'weightKg'>>) => {
    const existingTimer = rowTimers.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    // Mescla com o que ja estava pendente: reps e depois peso, no mesmo
    // instante de mao parada, nao podem fazer o segundo timer sobrescrever o
    // campo que o primeiro ia gravar.
    const merged = { ...pendingPatches.current.get(id), ...patch };
    pendingPatches.current.set(id, merged);

    rowTimers.current.set(
      id,
      setTimeout(() => {
        rowTimers.current.delete(id);
        const toWrite = pendingPatches.current.get(id);
        pendingPatches.current.delete(id);
        if (toWrite) commitRowNow(id, toWrite);
      }, COMMIT_DELAY),
    );
  };

  // Sair da tela no meio do ajuste nao pode perder o ultimo toque — mesmo
  // contrato do `TargetsEditor`, so que um timer por serie em vez de um so.
  useEffect(
    () => () => {
      for (const [id, timer] of rowTimers.current) {
        clearTimeout(timer);
        const pending = pendingPatches.current.get(id);
        if (pending) commitRowNow(id, pending);
      }
    },
    [],
  );

  // Grava o exercicio inteiro com o estado da caixa — igual ao `write` de
  // `RunExerciseCard`, so que substituindo series divergentes em vez de um
  // alvo uniforme. `inserted` traz os ids reais de volta: sem isso, editar uma
  // serie logo depois de marcar concluido nao encontraria linha para
  // atualizar, porque o rascunho local ainda teria `id: null` nela.
  const write = (nextRows: SetDraft[], nextDone: boolean) => {
    setDone(nextDone);
    writingCount.current += 1;

    setSessionExerciseSets(
      sessionId,
      item.exerciseId,
      nextRows.map((row) => ({ reps: row.reps, weightKg: row.weightKg })),
      nextDone,
    )
      .then((inserted) => {
        setRows(inserted);
        bumpData();
      })
      .catch((error) => {
        setDone(!nextDone);
        console.warn('[CleanGym] falha ao gravar', item.exerciseName, error);
      })
      .finally(() => {
        writingCount.current -= 1;
      });
  };

  const toggle = () => {
    confirm();
    write(rows, !done);
  };

  const updateRow = (index: number, patch: Partial<Pick<SetDraft, 'reps' | 'weightKg'>>) => {
    const row = rows[index];
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    // Mesma regra do stepper no card antigo: so grava ao vivo se o exercicio
    // ja esta concluido. Desmarcado, o ajuste fica so no rascunho ate a caixa
    // marcar — e o toggle leva `rows` junto, entao nada se perde.
    if (done && row?.id) scheduleRowCommit(row.id, patch);
  };

  const addRow = () => {
    const last = rows[rows.length - 1];

    if (done) {
      confirm();
      writingCount.current += 1;
      addSet(sessionId, item.exerciseId, true)
        .then((created) => {
          setRows((current) => [...current, created]);
          bumpData();
        })
        .catch((error) =>
          console.warn('[CleanGym] falha ao adicionar série', item.exerciseName, error),
        )
        .finally(() => {
          writingCount.current -= 1;
        });
    } else {
      setRows((current) => [
        ...current,
        { id: null, setIndex: current.length + 1, reps: last?.reps ?? 10, weightKg: last?.weightKg ?? 0 },
      ]);
    }
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return; // sempre sobra pelo menos uma serie
    const row = rows[index];

    if (row.id) {
      const timer = rowTimers.current.get(row.id);
      if (timer) clearTimeout(timer);
      rowTimers.current.delete(row.id);
      pendingPatches.current.delete(row.id);
    }

    if (done && row.id) {
      confirm();
      writingCount.current += 1;
      removeSet(row.id)
        .then(bumpData)
        .catch((error) =>
          console.warn('[CleanGym] falha ao remover série', item.exerciseName, error),
        )
        .finally(() => {
          writingCount.current -= 1;
        });
    }

    setRows((current) => current.filter((_, i) => i !== index));
  };

  const setsMotion = useListMotion();

  return (
    <Card>
      <View style={[styles.itemHead, expanded && styles.itemHeadSpaced]}>
        <Pressable style={styles.itemText} onPress={() => setExpanded((value) => !value)}>
          <Body numberOfLines={1}>{item.exerciseName}</Body>
          <Meta numberOfLines={1}>
            {`${done ? 'concluído' : SOURCE_LABEL[item.source]} · ${strengthSummary(rows)}`}
          </Meta>
        </Pressable>

        {item.routineExerciseId ? (
          <Pressable hitSlop={hitSlop} onPress={() => void removeFromToday(sessionId, item)}>
            <TrashIcon size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <CheckCell checked={done} onPress={toggle} />
      </View>

      {expanded ? (
        <Animated.View {...setsMotion} style={styles.setsList}>
          {rows.map((row, index) => (
            <SetRow
              key={row.id ?? `draft-${index}`}
              index={index + 1}
              reps={row.reps}
              weightKg={row.weightKg}
              onChangeReps={(reps) => updateRow(index, { reps })}
              onChangeWeight={(weightKg) => updateRow(index, { weightKg })}
              onRemove={rows.length > 1 ? () => removeRow(index) : undefined}
            />
          ))}

          <Pressable style={styles.addSet} onPress={addRow}>
            <PlusIcon size={14} color={colors.textSecondary} />
            <Meta>Adicionar série</Meta>
          </Pressable>
        </Animated.View>
      ) : null}
    </Card>
  );
}

/** "5 km · 28 min" — o que a corrida do dia vale. */
function runSummary(targets: Targets): string {
  return `${formatDistance(targets.distanceKm)} km · ${formatDuration(targets.durationMin)}`;
}

/**
 * "3 × 10 · 62,5 kg · 1.875 kg" quando as series sao iguais, ou
 * "3 séries · 60–70 kg · 1.950 kg" quando a carga varia entre elas.
 *
 * O volume (`formatVolume`) continua bem definido nos dois casos — e sempre a
 * soma de reps × peso de cada serie, divergente ou nao.
 */
function strengthSummary(rows: readonly SetDraft[]): string {
  const { uniform, reps, weightRange, volume } = summarizeSets(rows);
  const [min, max] = weightRange;

  if (uniform) {
    return `${rows.length} × ${reps} · ${formatWeight(min)} kg · ${formatVolume(volume)} kg`;
  }

  const weightPart =
    min === max ? `${formatWeight(min)} kg` : `${formatWeight(min)}–${formatWeight(max)} kg`;
  const repsPart = reps !== null ? ` · ${reps} reps` : '';
  return `${rows.length} séries${repsPart} · ${weightPart} · ${formatVolume(volume)} kg`;
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

  const buckets = groupSetsByExercise(sets);
  const recorded = recordedByExercise(buckets, catalog);
  const items: SessionExercise[] = [];

  for (const item of planned) {
    const entry = recorded.get(item.exerciseId) ?? null;
    // Numero gravado ganha do herdado mesmo desmarcado: e o ajuste que o
    // usuario fez neste dia, e perde-lo ao sair da tela seria pior que
    // mostra-lo sem contar no volume.
    const targets = entry?.targets ?? item.targets;
    items.push({
      id: item.id,
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      exerciseKind: item.exerciseKind,
      targets,
      rows: rowsForExercise(buckets.get(item.exerciseId), targets, item.exerciseKind),
      done: entry?.done ?? false,
      source: entry ? 'edited' : item.source === 'plan' ? 'plan' : 'lastActual',
      routineExerciseId: item.id,
    });
  }

  const inPlan = new Set(planned.map((item) => item.exerciseId));
  for (const [exerciseId, entry] of recorded) {
    if (inPlan.has(exerciseId)) continue;
    const exercise = catalog.find((candidate) => candidate.id === exerciseId);
    const exerciseKind = exercise?.kind ?? 'strength';
    items.push({
      id: exerciseId,
      exerciseId,
      exerciseName: exercise?.name ?? 'Exercício',
      exerciseKind,
      targets: entry.targets,
      rows: rowsForExercise(buckets.get(exerciseId), entry.targets, exerciseKind),
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
  };
}

/** O que ja existe no banco para um exercicio deste treino. */
type Recorded = { targets: Targets; done: boolean };

/**
 * As series de um treino, agrupadas por exercicio.
 *
 * Bucketizacao crua, sem colapsar nada — e a base tanto de `recordedByExercise`
 * (que resume o grupo num `Targets` so, para a cascata e para corrida) quanto
 * de `rowsForExercise` (que precisa das linhas cruas, uma por serie, para o
 * editor por serie de musculacao).
 */
function groupSetsByExercise(sets: readonly SessionSet[]): Map<string, SessionSet[]> {
  const buckets = new Map<string, SessionSet[]>();
  for (const set of sets) {
    const bucket = buckets.get(set.exerciseId);
    if (bucket) bucket.push(set);
    else buckets.set(set.exerciseId, [set]);
  }
  return buckets;
}

/**
 * Os numeros ja gravados, um por exercicio, marcados ou nao.
 *
 * Olha tambem as linhas com `done = 0`, ao contrario do resto do app: elas sao
 * exatamente o exercicio que o usuario ajustou mas ainda nao marcou como feito,
 * e a tela precisa mostrar o numero dele. Quem filtra por `done` e o volume,
 * nao esta leitura.
 *
 * A derivacao dos numeros reusa as duas regras do resto do app: corrida soma as
 * linhas, carga pega a ultima serie e conta quantas foram. As duas exigem
 * `done`, por isso o `done: true` forcado abaixo — aqui a pergunta e "que
 * numeros sao esses", nao "isso foi levantado". O `done` de verdade do grupo
 * (usado pela caixa) vem de `bucket.some`, nao do forcado.
 */
function recordedByExercise(
  buckets: Map<string, SessionSet[]>,
  catalog: readonly { id: string; kind: ExerciseKind }[],
): Map<string, Recorded> {
  const kinds = new Map(catalog.map((exercise) => [exercise.id, exercise.kind]));

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

/**
 * As linhas do editor por serie de UM exercicio de musculacao — vazio na
 * corrida, que nao usa este editor.
 *
 * Com serie gravada nesta sessao, sao as linhas reais (`id` preenchido),
 * ordenadas por `setIndex` — inclusive as com `done = 0`, pela mesma razao de
 * `recordedByExercise`: e o exercicio ajustado e ainda nao marcado.
 *
 * Sem nada gravado (exercicio nunca tocado nesta sessao), sintetiza
 * `targets.sets` linhas virtuais (`id: null`) a partir do plano — a tela ainda
 * assim precisa mostrar series editaveis antes da primeira escrita.
 */
function rowsForExercise(
  bucket: SessionSet[] | undefined,
  targets: Targets,
  kind: ExerciseKind,
): SetDraft[] {
  if (kind === 'run') return [];

  if (bucket && bucket.length > 0) {
    return [...bucket]
      .sort((a, b) => a.setIndex - b.setIndex)
      .map((set) => ({ id: set.id, setIndex: set.setIndex, reps: set.reps, weightKg: set.weightKg }));
  }

  return Array.from({ length: Math.max(0, Math.floor(targets.sets)) }, (_, index) => ({
    id: null,
    setIndex: index + 1,
    reps: targets.reps,
    weightKg: targets.weightKg,
  }));
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
  },
  /** So quando algo vem depois — o editor de corrida (sempre) ou a lista de
   *  series (so expandida). Colapsado, o card nao pode sobrar respiro embaixo
   *  do nome sem nada la para justifica-lo. */
  itemHeadSpaced: {
    marginBottom: spacing.md,
  },
  itemText: {
    flex: 1,
  },
  setsList: {
    marginTop: spacing.md,
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
});

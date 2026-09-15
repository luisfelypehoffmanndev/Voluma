import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
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
import { type SetDraft, sameSetDrafts, summarizeSets } from '@/domain/sets';
import { sameTargets, targetsFromSets } from '@/domain/targets';
import { formatVolume, formatWeight } from '@/domain/volume';
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
import { Reveal } from '@/ui/Reveal';
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

  /**
   * `liveUpdates: false` porque ESTA tela e a dona do dado enquanto esta
   * aberta.
   *
   * Cada card mantem o estado otimista do que o usuario acabou de tocar, e a
   * escrita correspondente e adiada e coalescida (`useWriteBehind`). Recarregar
   * em cima da propria escrita nao traria informacao nenhuma — o banco so
   * confirmaria o que a tela ja mostra — e custava caro no pior momento
   * possivel: `loadSession` resolve a cascata de alvos da semana inteira, e ela
   * caia junto com o re-render da lista exatamente no instante do toque. Era o
   * que engasgava a contagem do volume, que roda na JS thread.
   *
   * Continua recarregando ao montar, ao voltar o foco (o usuario pode ter
   * registrado algo em outra tela) e via `reload()` — usado quando a LISTA
   * muda de verdade, ao adicionar ou remover um exercicio.
   */
  const { data, loading, reload } = useQuery(useCallback(() => loadSession(id), [id]), {
    liveUpdates: false,
  });

  /**
   * O que os cards estao mostrando AGORA, por exercicio.
   *
   * O numero do topo era uma consulta propria ao banco (`listSessionSets` +
   * `totalVolume`), entao so mudava depois de escrita + `bumpData` + recarga —
   * e quando a escrita falhava, nunca mudava. Agora ele e a soma do que esta na
   * tela: responde no mesmo quadro do toque, e a contagem de `CountingStat`
   * dispara na hora. O contador de concluidos, na linha de baixo, segue a mesma
   * regra pelo mesmo motivo.
   *
   * E um mapa de sobreposicao, nao a verdade inteira: quem nunca reportou cai
   * no que veio do banco em `loadSession`, entao a primeira renderizacao ja
   * mostra o numero certo, sem passar por zero — o que faria a contagem animar
   * do nada ao abrir a tela.
   */
  const [drafts, setDrafts] = useState<Record<string, { done: boolean; volume: number }>>({});

  const reportDraft = useCallback((exerciseId: string, done: boolean, volume: number) => {
    setDrafts((current) => {
      const previous = current[exerciseId];
      if (previous && previous.done === done && previous.volume === volume) return current;
      return { ...current, [exerciseId]: { done, volume } };
    });
  }, []);

  // `reload` do `useQuery` e uma funcao nova a cada render; os cards sao
  // memoizados e comparam props por referencia, entao ela precisa de uma
  // identidade estavel para nao derrubar o `memo` de todos eles.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const reloadStable = useCallback(() => reloadRef.current(), []);

  const [picking, setPicking] = useState(false);
  const listMotion = useListMotion();

  const items = data?.items;
  const sessionVolume = useMemo(() => {
    if (!items) return undefined;
    return items.reduce(
      (sum, item) =>
        sum +
        (drafts[item.exerciseId]?.volume ??
          draftVolume(item.exerciseKind, item.done, item.rows, item.targets)),
      0,
    );
  }, [items, drafts]);

  const doneCount = useMemo(
    () =>
      (items ?? []).filter((item) => drafts[item.exerciseId]?.done ?? item.done).length,
    [items, drafts],
  );

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

  const { session, catalog, routineId } = data;
  // `items` ja saiu de `data` la em cima, para a soma do volume — aqui so o
  // estreitamento de tipo, que o `if` de carregamento acima ja garantiu.
  const exercises = items ?? [];
  const date = fromDateKey(session.date);
  const used = new Set(exercises.map((item) => item.exerciseId));

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

      {/* O `Header` fica FORA do fade — ele ja estava na tela durante o
          carregamento, e faze-lo acender de novo seria animar uma troca que nao
          aconteceu. O volume entra junto com a lista porque ele tambem so
          existe depois da consulta: ate agora, ali, havia um spinner. */}
      <Reveal style={styles.reveal}>
      <View style={styles.summary}>
        <CountingStat kg={sessionVolume ?? undefined} size={fontSize.numberLg} />
        <View style={styles.summaryMeta}>
          <Label>Volume levantado</Label>
          <Meta>
            {`${weekdayName(weekdayOf(date))} · ${shortDate(date)} · ${doneCount} de ${exercises.length} concluídos`}
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
        {exercises.map((item) => (
          <Animated.View key={item.id} {...listMotion}>
            <ExerciseCard
              item={item}
              sessionId={session.id}
              onDraft={reportDraft}
              onStructuralChange={reloadStable}
            />
          </Animated.View>
        ))}

        {exercises.length === 0 ? (
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
      </Reveal>

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

/**
 * O volume de UM exercicio a partir do rascunho que esta na tela — o mesmo
 * numero que `totalVolume` daria depois que a escrita cair no banco.
 *
 * Existe para o topo da tela nao depender do banco: somando isto sobre os
 * exercicios, o "Volume levantado" responde no mesmo quadro do toque, e a
 * contagem do `CountingStat` dispara na hora em vez de esperar escrita +
 * `bumpData` + recarga. Segue a regra de `setVolume` (`src/domain/volume.ts`):
 * exercicio nao concluido nao conta — e alvo, nao carga levantada.
 *
 * Corrida entra pela mesma conta que o banco faz: uma linha so, com os reps e
 * a carga dos alvos (normalmente zero — corrida nao levanta peso), nunca a
 * distancia, que tem card proprio e unidade propria.
 */
function draftVolume(
  kind: ExerciseKind,
  done: boolean,
  rows: readonly SetDraft[],
  targets: Targets,
): number {
  if (!done) return 0;
  if (kind === 'run') return targets.reps * targets.weightKg;
  return summarizeSets(rows).volume;
}

/**
 * Escrita adiada, coalescida e que nunca desiste.
 *
 * Tres garantias, nessa ordem de importancia:
 *
 * 1. **Coalesce.** Cinco toques seguidos na mesma caixa viram UMA escrita, a do
 *    estado final. Antes cada toque abria sua propria transacao, e duas delas
 *    perto no tempo se sobrepunham na conexao compartilhada — a origem do erro
 *    que fazia a caixa voltar sozinha (ver `serializeTransactions` em
 *    `src/db/client.ts`). Menos escrita e menos chance de colisao, alem de
 *    menos trabalho na JS thread no instante do toque.
 * 2. **Uma em voo por vez.** Se um estado novo chega enquanto a escrita
 *    anterior ainda nao voltou, ele espera e entra depois — nunca em paralelo.
 * 3. **Nao perde.** Flush no unmount e ao mandar o app para segundo plano, para
 *    que sair da tela (ou fechar o app) no meio do debounce grave mesmo assim.
 *
 * O que ele deliberadamente NAO faz e avisar quem chamou sobre falha: o estado
 * da tela e a intencao do usuario, e ela nao se desfaz porque o SQLite
 * engasgou. Falhou, tenta de novo na proxima vez que houver algo pendente.
 */
function useWriteBehind<T>(perform: (value: T) => Promise<void>) {
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const performRef = useRef(perform);
  performRef.current = perform;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) return; // o `finally` abaixo reentra quando voltar
    const next = pending.current;
    if (!next) return;

    pending.current = null;
    inFlight.current = true;
    void performRef.current(next.value).finally(() => {
      inFlight.current = false;
      if (pending.current) flush();
    });
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, COMMIT_DELAY);
    },
    [flush],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  return { schedule, flush };
}

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
 * Compara dois `SessionExercise` por VALOR, campo a campo — nunca por
 * referencia.
 *
 * `loadSession` (mais abaixo) reconstroi `items` do zero a cada recarga:
 * `items.push({ ... })` cria um objeto NOVO por exercicio, inclusive os que
 * nao mudaram nem um pouco. Isso significa que todo `item` passado a
 * `ExerciseCard` e sempre uma referencia nova — a comparacao rasa padrao do
 * `memo` (que compara por referencia) nunca bloquearia re-render nenhum, e o
 * `memo` abaixo seria um no-op. Por isso o comparador tem que ser por valor.
 */
function sameSessionExercise(a: SessionExercise, b: SessionExercise): boolean {
  return (
    a.id === b.id &&
    a.exerciseId === b.exerciseId &&
    a.exerciseName === b.exerciseName &&
    a.exerciseKind === b.exerciseKind &&
    a.done === b.done &&
    a.source === b.source &&
    a.routineExerciseId === b.routineExerciseId &&
    sameTargets(a.targets, b.targets) &&
    sameSetDrafts(a.rows, b.rows)
  );
}

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
 * `setState` na raiz desta tela redesenharia todos eles. Usa o comparador de
 * valor `sameSessionExercise` — ver o comentario dela — em vez da comparacao
 * rasa padrao, que `loadSession` derrota sempre.
 */
type CardProps = {
  item: SessionExercise;
  sessionId: string;
  /** Avisa a tela do estado otimista deste card — ver `drafts` em `SessionScreen`. */
  onDraft: (exerciseId: string, done: boolean, volume: number) => void;
  /** Para quando a LISTA muda (exercicio removido), nao os numeros dele. */
  onStructuralChange: () => void;
};

const ExerciseCard = memo(
  function ExerciseCard(props: CardProps) {
    return props.item.exerciseKind === 'run' ? (
      <RunExerciseCard {...props} />
    ) : (
      <StrengthExerciseCard {...props} />
    );
  },
  // `onDraft` e `onStructuralChange` vem memoizados da tela, entao comparar por
  // referencia aqui e correto — ver `reportDraft`/`reloadStable`.
  (prev, next) =>
    prev.sessionId === next.sessionId &&
    prev.onDraft === next.onDraft &&
    prev.onStructuralChange === next.onStructuralChange &&
    sameSessionExercise(prev.item, next.item),
);

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
function RunExerciseCard({ item, sessionId, onDraft, onStructuralChange }: CardProps) {
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

  // A tela soma o volume e conta os concluidos a partir daqui, nao do banco —
  // e o que faz o numero do topo responder no mesmo quadro do toque.
  useEffect(() => {
    onDraft(item.exerciseId, done, draftVolume(item.exerciseKind, done, item.rows, targets));
  }, [onDraft, item.exerciseId, item.exerciseKind, item.rows, done, targets]);

  /**
   * A escrita e adiada e coalescida; o estado da tela nunca espera por ela, e
   * NUNCA e desfeito por ela.
   *
   * O `catch` daqui costumava fazer `setDone(!nextDone)` — desfazer o otimismo
   * quando o SQLite falhava. Era honesto no papel e pessimo na pratica: como
   * toda escrita estava falhando (ver `serializeTransactions` em
   * `src/db/client.ts`), a caixa marcava e desmarcava sozinha, e era isso que
   * parecia "delay". Marcar um exercicio e uma afirmacao do usuario sobre o
   * treino dele; um engasgo de banco nao tem autoridade para revogar. Falhou, o
   * estado continua pendente e a proxima escrita leva tudo junto.
   */
  const { schedule } = useWriteBehind<{ targets: Targets; done: boolean }>(
    useCallback(
      (value) =>
        setSessionExerciseTargets(
          sessionId,
          item.exerciseId,
          item.exerciseKind,
          value.targets,
          value.done,
        )
          // `bumpData` e para as OUTRAS telas (home, calendario, numeros). Esta
          // aqui ja mostra a verdade e nao recarrega com ele — ver
          // `liveUpdates: false` em `SessionScreen`.
          .then(bumpData)
          .catch((error) => console.warn('[Voluma] falha ao gravar', item.exerciseName, error)),
      [sessionId, item.exerciseId, item.exerciseKind, item.exerciseName],
    ),
  );

  const toggle = () => {
    // O haptico fica AQUI e nao no agendamento da escrita: o stepper tambem
    // agenda (para um exercicio ja marcado), e vibrar ali dispararia dezenas de
    // pulsos por exercicio. Confirmacao e o gesto da caixa, nao toda escrita.
    confirm();
    const nextDone = !done;
    setDone(nextDone);
    // Marcar leva junto o que estiver no stepper agora, inclusive um ajuste que
    // o usuario acabou de fazer e nunca foi ao banco.
    schedule({ targets, done: nextDone });
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
          <Pressable
            hitSlop={hitSlop}
            onPress={() => {
              // Some da lista: a tela precisa reconsultar, porque isso muda
              // QUAIS exercicios existem, nao so os numeros de um deles.
              void removeFromToday(sessionId, item).then(onStructuralChange);
            }}
          >
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
          if (done) schedule({ targets: next, done: true });
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
function StrengthExerciseCard({ item, sessionId, onDraft, onStructuralChange }: CardProps) {
  const [rows, setRows] = useState<SetDraft[]>(item.rows);
  const [done, setDone] = useState(item.done);
  const [expanded, setExpanded] = useState(false);

  const rowTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingPatches = useRef(new Map<string, Partial<Pick<SetDraft, 'reps' | 'weightKg'>>>());

  // A tela soma o volume e conta os concluidos a partir daqui, nao do banco —
  // e o que faz o numero do topo responder no mesmo quadro do toque.
  useEffect(() => {
    onDraft(item.exerciseId, done, draftVolume(item.exerciseKind, done, rows, item.targets));
  }, [onDraft, item.exerciseId, item.exerciseKind, item.targets, done, rows]);

  const commitRowNow = (id: string, patch: Partial<Pick<SetDraft, 'reps' | 'weightKg'>>) => {
    updateSet(id, patch)
      .then(bumpData)
      .catch((error) => console.warn('[Voluma] falha ao gravar série', item.exerciseName, error));
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

  /**
   * Grava o exercicio inteiro com o estado da caixa — mesma mecanica do
   * `RunExerciseCard`, so que substituindo series divergentes em vez de um alvo
   * uniforme, e pelas mesmas duas regras: adiada/coalescida, e **nunca** desfaz
   * o que esta na tela quando falha (ver o comentario la).
   *
   * `inserted` traz os ids reais de volta: sem isso, editar uma serie logo
   * depois de marcar concluido nao encontraria linha para atualizar, porque o
   * rascunho local ainda teria `id: null` nela. So aplica se nada novo entrou
   * na fila nesse meio tempo — senao sobrescreveria uma edicao mais recente do
   * usuario com o retorno de uma escrita ja velha.
   */
  const { schedule } = useWriteBehind<{ rows: SetDraft[]; done: boolean }>(
    useCallback(
      (value) =>
        setSessionExerciseSets(
          sessionId,
          item.exerciseId,
          value.rows.map((row) => ({ reps: row.reps, weightKg: row.weightKg })),
          value.done,
        )
          .then((inserted) => {
            setRows((current) =>
              sameSetDrafts(
                current.map((row) => ({ ...row, id: null })),
                inserted.map((row) => ({ ...row, id: null })),
              )
                ? inserted
                : current,
            );
            bumpData();
          })
          .catch((error) => console.warn('[Voluma] falha ao gravar', item.exerciseName, error)),
      [sessionId, item.exerciseId, item.exerciseName],
    ),
  );

  const toggle = () => {
    confirm();
    const nextDone = !done;
    setDone(nextDone);
    schedule({ rows, done: nextDone });
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
      addSet(sessionId, item.exerciseId, true)
        .then((created) => {
          setRows((current) => [...current, created]);
          bumpData();
        })
        .catch((error) =>
          console.warn('[Voluma] falha ao adicionar série', item.exerciseName, error),
        );
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
      removeSet(row.id)
        .then(bumpData)
        .catch((error) =>
          console.warn('[Voluma] falha ao remover série', item.exerciseName, error),
        );
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
          <Pressable
            hitSlop={hitSlop}
            onPress={() => {
              // Muda QUAIS exercicios existem, nao os numeros de um deles —
              // por isso a tela reconsulta, e so aqui.
              void removeFromToday(sessionId, item).then(onStructuralChange);
            }}
          >
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
  // Estica igual ao que o `Reveal` embrulha — sem isto o scroll fica sem altura.
  reveal: { flex: 1 },
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

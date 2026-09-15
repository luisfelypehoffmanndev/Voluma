import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MUSCLE_GROUPS,
  addMissingCommonExercises,
  missingCommonExercises,
  normalizeName,
  type MuscleGroup,
} from '@/db/catalog';
import { createExercise, deleteExercise, exerciseDayCounts, listExercises } from '@/db/repo';
import type { Exercise } from '@/domain/types';
import { MOVEMENT_LIBRARY, artSlugFor } from '@/movements/library';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, hitSlop, radius, spacing, surfaces } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { MovementFigure } from '@/ui/MovementFigure';
import { confirm } from '@/ui/haptics';
import { PressableSurface } from '@/ui/PressableSurface';
import { Reveal } from '@/ui/Reveal';
import { Header, Screen } from '@/ui/Screen';
import { Body, Label, Meta } from '@/ui/Text';
import { ChevronLeftIcon, TrashIcon } from '@/ui/icons';

/** Onde cai um exercicio que nao tem grupo, ou tem um fora da lista conhecida. */
const UNGROUPED = 'Outros';

/**
 * O catalogo de movimentos.
 *
 * E a unica tela que trata exercicio como coisa em si, e nao como item de um
 * dia: em Ajustes/Dia o exercicio so existe dentro de uma rotina, e no treino
 * so existe dentro de uma sessao. Aqui ele e a entidade.
 *
 * Por isso apagar mora aqui e nao la: a lixeira da tela do dia tira o
 * movimento DAQUELE dia; esta apaga o movimento do app inteiro.
 */
export default function CatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, loading } = useQuery(
    useCallback(async () => {
      const [exercises, days, missing] = await Promise.all([
        listExercises(),
        exerciseDayCounts(),
        missingCommonExercises(),
      ]);
      return { exercises, days, missingCount: missing.length };
    }, []),
  );

  const exercises = data?.exercises ?? [];
  const groups = groupByMuscle(exercises);

  // Uma pergunta por tela, nao um modal montado por linha.
  const [removing, setRemoving] = useState<{ exercise: Exercise; days: number } | null>(null);

  // Guarda contra o toque duplo: sao ~60 inserts, e duas execucoes disparadas
  // juntas leriam o mesmo catalogo vazio e criariam tudo em dobro — a
  // idempotencia de `addMissingCommonExercises` e por leitura, nao por lock.
  const [adding, setAdding] = useState(false);

  const addCommon = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await addMissingCommonExercises();
      bumpData();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Screen>
      <Header
        title="Catálogo"
        action={{ icon: <ChevronLeftIcon size={20} />, onPress: () => router.back() }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        // Sem isto, o primeiro toque fora do campo de nome so fecha o teclado e
        // se perde — inclusive o toque no proprio botao de adicionar.
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <NewExerciseCard existing={exercises} />

        {/* A saida para os 288 que o app conhece. Fica logo abaixo do campo de
            nome de proposito: quem chegou aqui para digitar um movimento novo e
            exatamente quem nao precisava digitar. */}
        <Card onPress={() => router.push('/library')}>
          <Label>Biblioteca</Label>
          <View style={styles.commonText}>
            <Body>{`${MOVEMENT_LIBRARY.length} movimentos`}</Body>
            <Meta>com grupo, equipamento e figura — escolha em vez de digitar</Meta>
          </View>
        </Card>

        {/* So aparece enquanto ha o que adicionar. Um botao que nao faz nada e
            pior que nenhum, e depois de completo o catalogo comum some da tela
            para sempre. */}
        {(data?.missingCount ?? 0) > 0 ? (
          <Card onPress={addCommon}>
            <Label>Exercícios comuns</Label>
            <View style={styles.commonText}>
              <Body>
                {adding ? 'Adicionando…' : `Adicionar ${data!.missingCount} movimentos`}
              </Body>
              <Meta>os mais usados de academia, já com grupo muscular</Meta>
            </View>
          </Card>
        ) : null}

        {loading ? <ActivityIndicator color={colors.textSecondary} /> : null}

        {/* So a lista entra por fade: o campo de nome e o card da biblioteca
            acima ja estavam na tela durante o carregamento. O `gap` repete o do
            `contentContainerStyle` porque esta View passa a ser o pai dos cards
            de grupo, e sem ele o espacamento entre eles colapsaria. */}
        {groups.length > 0 ? (
        <Reveal style={styles.reveal}>
        {groups.map(([group, items]) => (
          <Card key={group}>
            <Label>{`${group.toUpperCase()} · ${items.length}`}</Label>
            {items.map((exercise) => (
              <ExerciseRow
                key={exercise.id}
                exercise={exercise}
                days={data?.days.get(exercise.id) ?? 0}
                onRemove={setRemoving}
              />
            ))}
          </Card>
        ))}
        </Reveal>
        ) : null}

        {!loading && exercises.length === 0 ? (
          <Meta style={styles.empty}>Nenhum movimento no catálogo.</Meta>
        ) : null}
      </ScrollView>

      <ConfirmModal
        visible={removing != null}
        title={`Apagar ${removing?.exercise.name ?? ''}?`}
        message={removeMessage(removing?.days ?? 0)}
        cancelLabel="Cancelar"
        confirmLabel="Apagar"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) void deleteExercise(target.exercise.id).then(bumpData);
        }}
      />
    </Screen>
  );
}

/**
 * O que apagar custa. Pergunta sempre, inclusive fora do plano: some do
 * catalogo e dos seletores, e nao ha como desfazer.
 */
function removeMessage(days: number): string {
  const history = 'O histórico já registrado continua.';
  if (days === 0) return `Sai do catálogo e dos seletores. ${history}`;
  const where = `${days} ${days === 1 ? 'dia da semana' : 'dias da semana'}`;
  return `Está em ${where}. Apagar tira o movimento de todos eles. ${history}`;
}

/** Uma linha do catalogo: nome, onde ele e usado, e a acao de apagar. */
function ExerciseRow({
  exercise,
  days,
  onRemove,
}: {
  exercise: Exercise;
  days: number;
  onRemove: (target: { exercise: Exercise; days: number }) => void;
}) {
  const remove = () => onRemove({ exercise, days });

  return (
    <View style={styles.row}>
      <MovementFigure slug={artSlugFor(exercise.name)} size={40} />
      <View style={styles.rowText}>
        <Body numberOfLines={1}>{exercise.name}</Body>
        <Meta>{usageLabel(days, exercise.kind === 'run')}</Meta>
      </View>
      <Pressable hitSlop={hitSlop} onPress={remove} accessibilityLabel={`Apagar ${exercise.name}`}>
        <TrashIcon size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

/** "em 2 dias", "fora do plano" — onde o movimento e usado hoje. */
function usageLabel(days: number, isRun: boolean): string {
  const base = days === 0 ? 'fora do plano' : `em ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return isRun ? `${base} · distância e tempo` : base;
}

/**
 * Criar um movimento: nome e grupo.
 *
 * O grupo e escolha por chip, nao campo livre, porque ele so serve para agrupar
 * a lista — texto livre viraria "Peito", "peito" e "Peitoral" como tres secoes
 * do mesmo musculo. Quem quiser um grupo fora da lista fica em `Outros`, que a
 * leitura ja cobre.
 */
function NewExerciseCard({ existing }: { existing: readonly Exercise[] }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup>('Peito');

  const trimmed = name.trim();
  const duplicate =
    trimmed.length > 0 &&
    existing.some((exercise) => normalizeName(exercise.name) === normalizeName(trimmed));
  const canAdd = trimmed.length > 0 && !duplicate;

  const add = async () => {
    if (!canAdd) return;
    confirm();
    await createExercise(trimmed, group);
    setName('');
    bumpData();
  };

  return (
    <Card>
      <Label>Novo movimento</Label>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nome do exercício"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        onSubmitEditing={add}
        autoCorrect={false}
      />

      <View style={styles.chips}>
        {MUSCLE_GROUPS.map((option) => {
          const selected = option === group;
          return (
            <Pressable
              key={option}
              onPress={() => setGroup(option)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Label style={selected ? styles.chipLabelSelected : undefined}>{option}</Label>
            </Pressable>
          );
        })}
      </View>

      {/* Unico accent da tela. Apagado enquanto nao ha nome valido: um botao
          aceso que nao faz nada mente sobre o proprio estado. */}
      <PressableSurface
        onPress={add}
        disabled={!canAdd}
        pressedOpacity={0.8}
        borderRadius={radius.pill}
        style={[styles.add, !canAdd && styles.addDisabled]}
      >
        <Body style={canAdd ? styles.addLabel : styles.addLabelDisabled}>
          {duplicate ? 'Já existe no catálogo' : 'Adicionar'}
        </Body>
      </PressableSurface>
    </Card>
  );
}

/**
 * A lista agrupada, na ordem de `MUSCLE_GROUPS`.
 *
 * Grupo desconhecido ou vazio cai em `Outros`, sempre no fim: exercicio criado
 * antes desta tela existir nao tem grupo, e some da lista se a leitura so
 * enxergar os grupos conhecidos.
 */
function groupByMuscle(exercises: readonly Exercise[]): [string, Exercise[]][] {
  const buckets = new Map<string, Exercise[]>();

  for (const exercise of exercises) {
    const group = exercise.muscleGroup?.trim() || UNGROUPED;
    const known = (MUSCLE_GROUPS as readonly string[]).includes(group) ? group : UNGROUPED;
    const bucket = buckets.get(known);
    if (bucket) bucket.push(exercise);
    else buckets.set(known, [exercise]);
  }

  const ordered: [string, Exercise[]][] = [];
  for (const group of MUSCLE_GROUPS) {
    const bucket = buckets.get(group);
    if (bucket) ordered.push([group, bucket]);
  }
  const rest = buckets.get(UNGROUPED);
  if (rest) ordered.push([UNGROUPED, rest]);

  return ordered;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  reveal: { gap: spacing.md },
  input: {
    marginTop: spacing.sm,
    fontFamily: 'Inter_400Regular',
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  /** Selecionado e nivel 2: uma superficie dentro do card, nao uma cor nova. */
  chipSelected: {
    backgroundColor: surfaces.raised,
    borderColor: colors.borderStrong,
  },
  chipLabelSelected: {
    color: colors.textPrimary,
  },
  add: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: {
    backgroundColor: surfaces.raised,
  },
  addLabel: {
    color: colors.textOnAccent,
  },
  addLabelDisabled: {
    color: colors.textSecondary,
  },
  commonText: {
    marginTop: spacing.sm,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  empty: {
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
  },
});

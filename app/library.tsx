import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MUSCLE_GROUPS, normalizeName, type MuscleGroup } from '@/db/catalog';
import { createExercise, listExercises } from '@/db/repo';
import { filterMovements, libraryEquipment, type Movement } from '@/movements/library';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, radius, spacing, surfaces } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { MovementFigure } from '@/ui/MovementFigure';
import { PressableSurface } from '@/ui/PressableSurface';
import { EmptyState } from '@/ui/EmptyState';
import { LoadError } from '@/ui/LoadError';
import { Header, Screen } from '@/ui/Screen';
import { Body, Label, Meta } from '@/ui/Text';
import { CheckIcon, PlusIcon } from '@/ui/icons';

/**
 * A biblioteca de movimentos.
 *
 * O catalogo (`app/catalog.tsx`) e o que o usuario tem; esta tela e o que o app
 * conhece — 288 movimentos com nome, grupo, equipamento e, para os comuns,
 * figura. Sao telas separadas porque as perguntas sao diferentes: no catalogo a
 * pergunta e "o que eu treino", aqui e "existe nome pronto para isso que eu
 * quero fazer".
 *
 * Nada aqui esta no banco ate alguem tocar em adicionar. Ver o comentario de
 * `src/movements/library.ts` para o porque de nao semear os 288.
 *
 * **Sem accent nesta tela.** Ela e uma grade de acoes equivalentes, e o brief
 * so admite um elemento accent por tela — pintar o botao de adicionar de
 * laranja daria 288 deles.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const { data, loading, error, reload } = useQuery(
    useCallback(async () => {
      const exercises = await listExercises();
      return new Set(exercises.map((exercise) => normalizeName(exercise.name)));
    }, []),
  );

  const owned = data ?? new Set<string>();
  const equipmentOptions = useMemo(() => libraryEquipment(), []);
  const results = useMemo(
    () => filterMovements({ group, equipment, search }),
    [group, equipment, search],
  );

  const add = async (movement: Movement) => {
    // Guarda contra o toque duplo e contra o movimento que o usuario ja tem sob
    // outro caminho: `exercises` nao tem unique por nome, e duplicata no
    // catalogo quebra o historico, que e por exercicio.
    if (owned.has(normalizeName(movement.name))) return;
    await createExercise(movement.name, movement.muscleGroup, movement.kind);
    bumpData();
  };

  return (
    <Screen>
      <Header title="Biblioteca" back="push" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Card>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar movimento"
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
          />

          <Chips
            options={MUSCLE_GROUPS}
            selected={group}
            onSelect={(next) => setGroup(next as MuscleGroup | null)}
          />
          <Chips options={equipmentOptions} selected={equipment} onSelect={setEquipment} />
        </Card>

        {loading ? <ActivityIndicator color={colors.textSecondary} /> : null}
        {error ? <LoadError error={error} onRetry={reload} /> : null}

        <Card>
          <Label>{`${results.length} ${results.length === 1 ? 'MOVIMENTO' : 'MOVIMENTOS'}`}</Label>
          {results.map((movement) => (
            <MovementRow
              key={movement.slug}
              movement={movement}
              owned={owned.has(normalizeName(movement.name))}
              onAdd={() => add(movement)}
            />
          ))}
          {results.length === 0 ? (
            <EmptyState
              title="Nenhum movimento encontrado"
              message={
                search.trim()
                  ? 'A biblioteca não conhece esse nome. Crie o seu.'
                  : 'Nenhum movimento combina com esses filtros.'
              }
              action={
                search.trim()
                  ? {
                      label: `Criar “${search.trim()}”`,
                      onPress: async () => {
                        if (owned.has(normalizeName(search))) return;
                        await createExercise(search.trim(), group ?? undefined);
                        setSearch('');
                        bumpData();
                      },
                    }
                  : {
                      label: 'Limpar filtros',
                      onPress: () => {
                        setGroup(null);
                        setEquipment(null);
                      },
                    }
              }
            />
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

/**
 * Uma faixa de chips onde tocar no selecionado desmarca.
 *
 * Sem "Todos": um chip que representa a ausencia de filtro ocupa espaco para
 * dizer o que a tela ja mostra quando nenhum esta aceso.
 */
function Chips({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string | null;
  onSelect: (next: string | null) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(active ? null : option)}
            style={[styles.chip, active && styles.chipSelected]}
          >
            <Label style={active ? styles.chipLabelSelected : undefined}>{option}</Label>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Figura, nome, equipamento e o botao de trazer para o catalogo. */
function MovementRow({
  movement,
  owned,
  onAdd,
}: {
  movement: Movement;
  owned: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={styles.row}>
      <MovementFigure slug={movement.illustrated ? movement.slug : null} size={44} />

      <View style={styles.rowText}>
        <Body numberOfLines={1}>{movement.name}</Body>
        <Meta>{`${movement.muscleGroup} · ${movement.equipment}`}</Meta>
      </View>

      {/* Ja no catalogo vira estado, nao botao: um "adicionar" que nao adiciona
          mente sobre o proprio estado, e esconder a linha faria o movimento
          sumir da busca de quem foi conferir se ja tinha. */}
      {owned ? (
        <View style={styles.owned}>
          <CheckIcon size={14} color={colors.textSecondary} />
        </View>
      ) : (
        <PressableSurface
          onPress={onAdd}
          feedback="control"
          borderRadius={radius.pill}
          style={styles.add}
        >
          <PlusIcon size={14} color={colors.textPrimary} />
        </PressableSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  input: {
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
  chipSelected: {
    backgroundColor: surfaces.raised,
    borderColor: colors.borderStrong,
  },
  chipLabelSelected: {
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  add: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: surfaces.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Mesma caixa do botao, sem fundo: a linha nao pode pular de altura. */
  owned: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: spacing.xxl,
    textAlign: 'center',
  },
});

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Exercise, Targets } from '@/domain/types';
import { colors, fontSize, fonts, radius, spacing } from '@/theme/tokens';

import { GlassSurface } from './GlassSurface';
import { Header } from './Screen';
import { Body, Meta } from './Text';
import { ArrowDownIcon, PlusIcon } from './icons';

/** Alvos iniciais de um exercicio recem-adicionado, ajustaveis logo em seguida. */
export const DEFAULT_TARGETS: Targets = {
  sets: 3,
  reps: 10,
  weightKg: 0,
  distanceKm: 0,
  durationMin: 0,
};

/** Alvos iniciais de uma corrida: 5 km em 30 min e o ponto de partida obvio. */
export const DEFAULT_RUN_TARGETS: Targets = {
  sets: 1,
  reps: 0,
  weightKg: 0,
  distanceKm: 5,
  durationMin: 30,
};

type Props = {
  visible: boolean;
  /** Catalogo ja filtrado pelo chamador (ex: sem os que a rotina ja tem). */
  catalog: readonly Exercise[];
  /** Texto sob o titulo, para dizer o que a escolha vai causar. */
  subtitle?: string;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  onCreate: (name: string) => void;
};

/**
 * Escolher um movimento do catalogo, ou criar um novo digitando o nome.
 *
 * Compartilhado entre a edicao de rotina e o treino em andamento — as duas
 * telas precisam exatamente da mesma busca-ou-cria.
 *
 * O painel e de vidro: ele flutua sobre a lista da tela de origem, que continua
 * visivel atras. E o caso que o brief descreve como vidro legitimo.
 */
export function ExercisePicker({
  visible,
  catalog,
  subtitle,
  onClose,
  onPick,
  onCreate,
}: Props) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const term = search.trim().toLowerCase();
  const matches = term
    ? catalog.filter((exercise) => exercise.name.toLowerCase().includes(term))
    : catalog;
  const canCreate = term.length > 0 && !matches.some((e) => e.name.toLowerCase() === term);

  const close = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent>
      <View style={styles.backdrop}>
        <GlassSurface
          borderRadius={radius.card}
          style={[styles.panel, { paddingTop: insets.top + spacing.sm }]}
        >
          <Header title="Exercícios" action={{ icon: <ArrowDownIcon size={20} />, onPress: close }} />

          <View style={styles.body}>
            {subtitle ? <Meta style={styles.subtitle}>{subtitle}</Meta> : null}

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar ou criar"
              placeholderTextColor={colors.textSecondary}
              style={styles.search}
              autoCorrect={false}
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
              keyboardShouldPersistTaps="handled"
            >
              {canCreate ? (
                <Pressable style={styles.row} onPress={() => onCreate(search.trim())}>
                  <PlusIcon size={16} color={colors.textSecondary} />
                  <Body style={styles.name}>Criar “{search.trim()}”</Body>
                </Pressable>
              ) : null}

              {matches.map((exercise) => (
                <Pressable key={exercise.id} style={styles.row} onPress={() => onPick(exercise.id)}>
                  <Body style={styles.name} numberOfLines={1}>
                    {exercise.name}
                  </Body>
                  {exercise.kind === 'run' ? (
                    <Meta>km</Meta>
                  ) : exercise.muscleGroup ? (
                    <Meta>{exercise.muscleGroup}</Meta>
                  ) : null}
                </Pressable>
              ))}

              {matches.length === 0 && !canCreate ? (
                <Meta style={styles.empty}>Catálogo vazio. Digite um nome para criar.</Meta>
              ) : null}
            </ScrollView>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Escurece o que fica atras sem esconder: o vidro precisa ter o que borrar.
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  panel: {
    // Nao cobre a tela toda de proposito — a faixa visivel no topo e o que
    // deixa claro que ha conteudo atras do vidro.
    height: '92%',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  search: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontFamily: fonts.sans,
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: {
    flex: 1,
  },
  empty: {
    paddingVertical: spacing.xxl,
    textAlign: 'center',
  },
});

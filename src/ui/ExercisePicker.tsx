import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizeName } from '@/db/catalog';
import type { Exercise, ExerciseKind, Targets } from '@/domain/types';
import { artSlugFor, filterMovements } from '@/movements/library';
import { colors, fontSize, fonts, radius, spacing, surfaces } from '@/theme/tokens';

import { WithoutBlurTarget } from './blurTarget';
import { GlassSurface } from './GlassSurface';
import { useModalAnimation } from './motion';
import { MovementFigure } from './MovementFigure';
import { Header } from './Screen';
import { Body, Label, Meta } from './Text';
import { PlusIcon } from './icons';

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

/**
 * Quantos movimentos da biblioteca a lista mostra sem termo de busca.
 *
 * Sao 288, e despejar todos abaixo do catalogo do usuario transformaria a
 * rolagem numa parede. Com busca o teto sai do caminho — quem digitou "afundo"
 * quer ver os oito.
 */
const LIBRARY_PREVIEW = 12;

type Props = {
  visible: boolean;
  /**
   * O catalogo INTEIRO, nao o filtrado.
   *
   * A filtragem mora aqui porque a lista de escolha e a de dedupe da biblioteca
   * sao duas leituras diferentes do mesmo catalogo: a primeira esconde o que o
   * dia ja usa, a segunda precisa enxergar tudo. Recebendo so o filtrado, um
   * movimento que o usuario tem e que ja esta no dia reapareceria como oferta
   * da biblioteca, e adiciona-lo criaria uma segunda linha do mesmo exercicio.
   */
  catalog: readonly Exercise[];
  /** Os exercicios que a rotina ou a sessao ja tem, e por isso nao se escolhe de novo. */
  usedIds?: ReadonlySet<string>;
  /** Texto sob o titulo, para dizer o que a escolha vai causar. */
  subtitle?: string;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  onCreate: (name: string, muscleGroup?: string, kind?: ExerciseKind) => void;
  /**
   * Um modal que abre POR CIMA do seletor — a pergunta de alcance do treino.
   * Precisa morar dentro deste `Modal`: no iOS um segundo `Modal` irmao nao
   * abre enquanto este esta visivel ou saindo.
   */
  children?: ReactNode;
};

/**
 * Escolher um movimento do catalogo, ou criar um novo digitando o nome.
 *
 * Compartilhado entre a edicao de rotina e o treino em andamento — as duas
 * telas precisam exatamente da mesma busca-ou-cria.
 *
 * O painel e de vidro: ele flutua sobre a lista da tela de origem, que continua
 * visivel atras. E o caso que o brief descreve como vidro legitimo.
 *
 * Abaixo do catalogo vem a biblioteca (`src/movements/library.ts`): os
 * movimentos que o app conhece mas o usuario ainda nao tem. Adicionar dali cria
 * a linha em `exercises` com nome, grupo e tipo prontos, que e a diferenca
 * entre "Afundo para tras" e o que sairia de digitar as pressas.
 */
export function ExercisePicker({
  visible,
  catalog,
  usedIds,
  subtitle,
  onClose,
  onPick,
  onCreate,
  children,
}: Props) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  // Sem acento e sem caixa, igual ao catalogo: quem digita "triceps" no teclado
  // do celular tem que achar "Tríceps corda". A biblioteca vai um passo alem e
  // casa tambem grupo e equipamento (ver `filterMovements`), entao "biceps" la
  // devolve as roscas mesmo sem a palavra aparecer em nenhum nome.
  const term = normalizeName(search);

  const available = useMemo(
    () => (usedIds ? catalog.filter((exercise) => !usedIds.has(exercise.id)) : catalog),
    [catalog, usedIds],
  );

  const matches = term
    ? available.filter((exercise) => normalizeName(exercise.name).includes(term))
    : available;

  // Contra o catalogo inteiro, de proposito — ver o comentario de `catalog`.
  const known = useMemo(
    () => new Set(catalog.map((exercise) => normalizeName(exercise.name))),
    [catalog],
  );

  // A biblioteca so oferece o que o usuario ainda nao tem em lugar nenhum.
  const library = useMemo(() => {
    const all = filterMovements({ search }).filter(
      (movement) => !known.has(normalizeName(movement.name)),
    );
    return term ? all : all.slice(0, LIBRARY_PREVIEW);
  }, [known, search, term]);

  const canCreate =
    term.length > 0 &&
    !matches.some((exercise) => normalizeName(exercise.name) === term) &&
    !library.some((movement) => normalizeName(movement.name) === term);

  const close = () => {
    setSearch('');
    onClose();
  };

  const modalAnimation = useModalAnimation();

  return (
    <Modal visible={visible} animationType={modalAnimation} onRequestClose={close} transparent>
      {/* Um `Modal` do RN e uma janela propria no Android, e o alvo de blur da
          janela principal nao alcanca aqui — o painel fica fosco la, como
          sempre esteve. No iOS o material nativo nao le alvo e nada muda. */}
      <WithoutBlurTarget>
        <View style={styles.backdrop}>
          <GlassSurface
            borderRadius={radius.card}
            style={[styles.panel, { paddingTop: insets.top + spacing.sm }]}
          >
            <Header title="Exercícios" back="modal" onBack={close} />

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
                    <MovementFigure slug={artSlugFor(exercise.name)} size={32} />
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

                {library.length > 0 ? (
                  <Label style={styles.section}>Da biblioteca</Label>
                ) : null}

                {library.map((movement) => (
                  <Pressable
                    key={movement.slug}
                    style={styles.row}
                    onPress={() => onCreate(movement.name, movement.muscleGroup, movement.kind)}
                  >
                    <MovementFigure slug={movement.illustrated ? movement.slug : null} size={32} />
                    <Body style={styles.name} numberOfLines={1}>
                      {movement.name}
                    </Body>
                    <Meta>{movement.equipment}</Meta>
                  </Pressable>
                ))}

                {matches.length === 0 && library.length === 0 && !canCreate ? (
                  <Meta style={styles.empty}>Catálogo vazio. Digite um nome para criar.</Meta>
                ) : null}
              </ScrollView>
            </View>
          </GlassSurface>
        </View>
      </WithoutBlurTarget>
      {children}
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
    backgroundColor: surfaces.raised,
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
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  /**
   * A divisa entre o catalogo e a biblioteca.
   *
   * Precisa existir: sem ela, tocar num nome as vezes escolhe um exercicio que
   * ja e do usuario e as vezes cria um novo, e nada na tela diz qual.
   */
  section: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  name: {
    flex: 1,
  },
  empty: {
    paddingVertical: spacing.xxl,
    textAlign: 'center',
  },
});

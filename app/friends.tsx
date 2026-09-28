import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HANDLE_MAX, isValidHandle, normalizeHandle } from '@/domain/handle';
import { colorSlots, type FriendRow } from '@/domain/friends';
import { useFriends, type PendingRemoval } from '@/store/friends';
import { useAuth } from '@/sync/auth';
import type { RequestResult } from '@/sync/friends';
import { colors, fontSize, people, radius, spacing } from '@/theme/tokens';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { LoadError } from '@/ui/LoadError';
import { PressableSurface } from '@/ui/PressableSurface';
import { Header, Screen } from '@/ui/Screen';
import { Body, Label, Meta } from '@/ui/Text';
import { UndoToast, type UndoOffer } from '@/ui/UndoToast';
import { CheckIcon, CloseIcon, PlusIcon } from '@/ui/icons';
import { useAvatarUrls } from '@/ui/useAvatarUrls';

/**
 * Amigos: achar pelo @, pedir, aceitar, recusar.
 *
 * Busca por match exato, nunca por pedaco do @: uma busca parcial
 * transformaria a tela num diretorio pesquisavel da academia inteira, e
 * ninguem escolheu aparecer nisso.
 *
 * Aceite e obrigatorio. Sem ele, daria para acompanhar o treino de alguem sem
 * essa pessoa saber — que e exatamente o que nao pode existir aqui.
 *
 * Recusar, cancelar e desfazer nao perguntam nada: a linha some na hora e o
 * "Desfazer" fica na tela. Quem segura a escrita ate a janela fechar e o store
 * (`useFriends`), nao esta tela.
 */
export default function FriendsScreen() {
  const userId = useAuth((state) => state.userId);
  const insets = useSafeAreaInsets();
  const {
    lists,
    loading,
    error,
    pendingRemoval,
    load,
    request,
    respond,
    remove,
    commitPending,
    undoPending,
  } = useFriends();

  // Sair da tela no meio da janela grava mesmo assim. O relogio do store
  // sobreviveria a desmontagem, mas ai a acao ficaria esperando um "Desfazer"
  // que ninguem mais pode ver.
  useEffect(() => () => void commitPending(), [commitPending]);

  // Memorizado pela pendencia: um objeto novo a cada render reiniciaria o
  // prazo do toast.
  const undo = useMemo<UndoOffer | null>(
    () =>
      pendingRemoval
        ? { id: pendingRemoval.id, message: undoMessage(pendingRemoval), onUndo: undoPending }
        : null,
    [pendingRemoval, undoPending],
  );

  const [handle, setHandle] = useState('');
  const [result, setResult] = useState<RequestResult | 'error' | null>(null);

  const submit = useCallback(async () => {
    if (!isValidHandle(handle)) return;
    const outcome = await request(handle);
    setResult(outcome);
    if (outcome === 'ok') setHandle('');
  }, [handle, request]);

  // A mesma cor de cada amigo nos graficos. Pedido pendente ainda nao tem cor:
  // a cor e de quem ja e amigo.
  const slots = useMemo(() => colorSlots(lists.accepted, people.friends.length), [lists.accepted]);
  const urls = useAvatarUrls(
    [...lists.accepted, ...lists.incoming, ...lists.outgoing].map((row) => row.avatarPath),
  );

  const empty =
    lists.accepted.length === 0 && lists.incoming.length === 0 && lists.outgoing.length === 0;

  return (
    <Screen
      overlay={
        <UndoToast
          offer={undo}
          onExpire={() => void commitPending()}
          bottom={insets.bottom + spacing.xl}
        />
      }
    >
      <Header title="Amigos" back />

      {error ? (
        <LoadError error={new Error(error)} onRetry={() => void load()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Card>
            <Label>Adicionar</Label>
            <View style={styles.field}>
              <Body style={styles.at}>@</Body>
              <TextInput
                accessibilityLabel="@handle do amigo"
                style={styles.input}
                value={handle}
                onChangeText={(text) => {
                  setHandle(normalizeHandle(text.replace(/\s/g, '.')));
                  setResult(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={HANDLE_MAX}
                placeholder="o @ da pessoa"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
              />
              <RoundAction
                label="Enviar pedido"
                disabled={!isValidHandle(handle) || loading}
                onPress={() => void submit()}
              >
                <PlusIcon size={14} color={colors.textPrimary} />
              </RoundAction>
            </View>
            {/* Sem cor de estado: o que informa e o texto. */}
            <Meta>{requestMessage(result)}</Meta>
          </Card>

          {lists.incoming.length > 0 ? (
            <Card>
              <Label>Pedidos</Label>
              {lists.incoming.map((row) => (
                <View key={row.id} style={styles.row}>
                  <FriendAvatar row={row} urls={urls} color={colors.textSecondary} />
                  <View style={styles.rowText}>
                    <Body>@{row.handle}</Body>
                    <Meta>quer ser seu amigo</Meta>
                  </View>
                  <View style={styles.actions}>
                    <RoundAction
                      label={`Recusar @${row.handle}`}
                      onPress={() => void respond(userId ?? '', row.id, false)}
                    >
                      <CloseIcon size={14} color={colors.textSecondary} />
                    </RoundAction>
                    <RoundAction
                      label={`Aceitar @${row.handle}`}
                      onPress={() => void respond(userId ?? '', row.id, true)}
                    >
                      <CheckIcon size={14} color={colors.textPrimary} />
                    </RoundAction>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {lists.outgoing.length > 0 ? (
            <Card>
              <Label>Enviados</Label>
              {lists.outgoing.map((row) => (
                <View key={row.id} style={styles.row}>
                  <FriendAvatar row={row} urls={urls} color={colors.textSecondary} />
                  <View style={styles.rowText}>
                    <Body>@{row.handle}</Body>
                    <Meta>aguardando resposta</Meta>
                  </View>
                  <RoundAction
                    label={`Cancelar pedido para @${row.handle}`}
                    onPress={() => remove(userId ?? '', row.id)}
                  >
                    <CloseIcon size={14} color={colors.textSecondary} />
                  </RoundAction>
                </View>
              ))}
            </Card>
          ) : null}

          {lists.accepted.length > 0 ? (
            <Card>
              <Label>Amigos</Label>
              {lists.accepted.map((row) => (
                <View key={row.id} style={styles.row}>
                  <FriendAvatar
                    row={row}
                    urls={urls}
                    color={people.friends[slots.get(row.id) ?? 0]}
                  />
                  <View style={styles.rowText}>
                    <Body>@{row.handle}</Body>
                    <Meta>{friendMeta(row)}</Meta>
                  </View>
                  <RoundAction
                    label={`Desfazer amizade com @${row.handle}`}
                    onPress={() => remove(userId ?? '', row.id)}
                  >
                    <CloseIcon size={14} color={colors.textSecondary} />
                  </RoundAction>
                </View>
              ))}
            </Card>
          ) : null}

          {empty && !loading ? (
            <EmptyState
              title="Nenhum amigo ainda"
              message="Peça o @ de alguém da academia e adicione aqui."
              action={{ label: 'Atualizar', onPress: () => void load() }}
            />
          ) : null}

          {loading ? <ActivityIndicator color={colors.textSecondary} /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

/** Botao redondo de 32px, a mesma caixa do "adicionar" do catalogo de movimentos. */
/** A foto de uma linha: a inicial enquanto a URL nao chega, ou sem foto. */
function FriendAvatar({
  row,
  urls,
  color,
}: {
  row: FriendRow;
  urls: ReadonlyMap<string, string>;
  color: string;
}) {
  return (
    <Avatar
      handle={row.handle}
      uri={row.avatarPath ? (urls.get(row.avatarPath) ?? null) : null}
      path={row.avatarPath}
      color={color}
      size={36}
    />
  );
}

function RoundAction({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PressableSurface
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      feedback="control"
      borderRadius={radius.pill}
      style={styles.action}
    >
      {children}
    </PressableSurface>
  );
}

/**
 * Cada codigo do servidor diz uma coisa diferente, e a tela tem que dizer qual:
 * "nao existe esse @" nao e "voces ja sao amigos".
 */
function requestMessage(result: RequestResult | 'error' | null): string {
  switch (result) {
    case 'ok':
      return 'pedido enviado, falta a outra pessoa aceitar';
    case 'not-found':
      return 'não existe ninguém com esse @';
    case 'already':
      return 'vocês já têm um pedido ou uma amizade';
    case 'self':
      return 'esse @ é o seu';
    case 'error':
      return 'não foi possível enviar, tente de novo';
    default:
      return 'o @ exato da pessoa, não há busca por parte do nome';
  }
}

/** O que sumiu da lista, dito do jeito de cada botao que o tirou. */
function undoMessage(pending: PendingRemoval): string {
  const who = pending.row ? `@${pending.row.handle} · ` : '';
  if (pending.kind === 'respond') return `${who}pedido recusado`;
  if (pending.row?.status === 'pending') return `${who}pedido cancelado`;
  return `${who}amizade desfeita`;
}

/**
 * O que se sabe de um amigo depende do toggle DELE. Quando esta desligado, a
 * tela diz isso em vez de mostrar espaco vazio — senao parece defeito.
 */
function friendMeta(row: FriendRow): string {
  if (!row.sharesStats) return 'não compartilha os números';

  const traits = [
    row.age === null ? null : `${row.age} anos`,
    row.trainingYears === null ? null : `${row.trainingYears} de treino`,
  ].filter(Boolean);

  return traits.length > 0 ? traits.join(' · ') : 'compartilha os números';
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  at: {
    fontSize: fontSize.bodyLg,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

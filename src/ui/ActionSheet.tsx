import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { ConfirmContent } from './ConfirmModal';
import { PressableSurface } from './PressableSurface';
import { Sheet } from './Sheet';
import { Body, Label, Meta } from './Text';

export type SheetAction = {
  label: string;
  /** Uma linha dizendo o alcance da acao — "so neste treino", "toda segunda". */
  detail?: string;
  onPress: () => void;
  /**
   * Pergunta antes de rodar. A pergunta troca o conteudo DESTE painel em vez
   * de abrir um segundo modal: no iOS um `Modal` do RN nao abre enquanto outro
   * ainda esta saindo, e a confirmacao simplesmente nao apareceria.
   */
  confirm?: { title: string; message?: string; confirmLabel: string };
};

type Props = {
  visible: boolean;
  title: string;
  actions: readonly SheetAction[];
  onClose: () => void;
};

/**
 * O menu de "mais opcoes" (⋯).
 *
 * Cada acao leva uma segunda linha com o alcance dela. Sem isso "Pular hoje" e
 * "Remover do plano" parecem sinonimos, e confundir os dois era exatamente o
 * problema da lixeira que este menu substitui.
 *
 * Fechar o menu — tocar fora, Cancelar — nao executa nada. A acao escolhida so
 * roda depois que o painel saiu da tela (ver `onDismissed` em `Sheet`): pular ou
 * remover tira o card da lista, e desmontar o dono de um `Modal` que ainda esta
 * saindo podia travar os toques no iOS.
 */
export function ActionSheet({ visible, title, actions, onClose }: Props) {
  const [confirming, setConfirming] = useState<SheetAction | null>(null);

  // Reabrir o menu comeca sempre pela lista, nunca por uma pergunta que ficou
  // pendurada da ultima vez.
  useEffect(() => {
    if (!visible) setConfirming(null);
  }, [visible]);

  const chosen = useRef<SheetAction | null>(null);

  const run = (action: SheetAction) => {
    chosen.current = action;
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        const action = chosen.current;
        chosen.current = null;
        action?.onPress();
      }}
    >
      {confirming?.confirm ? (
        <ConfirmContent
          title={confirming.confirm.title}
          message={confirming.confirm.message}
          cancelLabel="Cancelar"
          confirmLabel={confirming.confirm.confirmLabel}
          onCancel={onClose}
          onConfirm={() => run(confirming)}
        />
      ) : (
        <>
          <Label style={styles.title}>{title}</Label>
          {actions.map((action) => (
            <PressableSurface
              key={action.label}
              feedback="solid"
              style={styles.row}
              onPress={() => (action.confirm ? setConfirming(action) : run(action))}
            >
              <View style={styles.rowText}>
                <Body>{action.label}</Body>
                {action.detail ? <Meta>{action.detail}</Meta> : null}
              </View>
            </PressableSurface>
          ))}
          <PressableSurface feedback="solid" style={styles.row} onPress={onClose}>
            <Body style={styles.cancel}>Cancelar</Body>
          </PressableSurface>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowText: {
    gap: 2,
  },
  cancel: {
    color: colors.textSecondary,
  },
});

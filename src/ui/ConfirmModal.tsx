import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { fontSize, spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Sheet, SheetPanel } from './Sheet';
import { Body, Meta } from './Text';

type ContentProps = {
  title: string;
  message?: string;
  /** Botao da esquerda. Numa confirmacao e o que desiste ("Cancelar"). */
  cancelLabel: string;
  /** Botao da direita: o que a pergunta propoe. */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

type Props = Omit<ContentProps, 'onCancel'> & {
  visible: boolean;
  /** Esconde o painel. Toque fora, "Cancelar" e as duas respostas passam por aqui. */
  onClose: () => void;
  /**
   * O que o botao da esquerda FAZ, alem de fechar. Numa confirmacao nao faz
   * nada; numa escolha ("So hoje" / "Toda segunda") e uma resposta.
   */
  onCancel?: () => void;
};

/**
 * Pergunta com duas respostas do mesmo tamanho.
 *
 * Os dois botoes sao `secondary`: o destrutivo nao ganha vermelho (cor de
 * estado, §7) nem accent (o accent e da tela, nao de um modal que aparece por
 * cima dela). O que diz o que acontece e o rotulo.
 *
 * A resposta so roda DEPOIS que o painel saiu da tela (ver `onDismissed` em
 * `Sheet`): fechar e agir no mesmo quadro — trocar de rota, recarregar a
 * lista — podia travar os toques do app inteiro no iOS.
 */
export function ConfirmModal({ visible, onClose, onCancel, onConfirm, ...content }: Props) {
  const answer = useRef<(() => void) | null>(null);

  const respond = (action: (() => void) | undefined) => {
    answer.current = action ?? null;
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => respond(undefined)}
      onDismissed={() => {
        const action = answer.current;
        answer.current = null;
        action?.();
      }}
    >
      <ConfirmContent
        {...content}
        onCancel={() => respond(onCancel)}
        onConfirm={() => respond(onConfirm)}
      />
    </Sheet>
  );
}

/**
 * A mesma pergunta como camada, sem `Modal` — para quem ja esta dentro de um
 * (o `ExercisePicker`). Ai a resposta roda na hora: o unico `Modal` que fecha e
 * o de fora, e nao ha dois saindo juntos.
 */
export function ConfirmOverlay({ visible, onClose, onCancel, onConfirm, ...content }: Props) {
  if (!visible) return null;
  return (
    <SheetPanel onClose={onClose}>
      <ConfirmContent
        {...content}
        onCancel={() => (onCancel ? onCancel() : onClose())}
        onConfirm={onConfirm}
      />
    </SheetPanel>
  );
}

/**
 * O miolo da pergunta, sem o painel em volta — para quem ja esta dentro de um
 * `Sheet` (o `ActionSheet`) e nao pode abrir um segundo.
 */
export function ConfirmContent({
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: ContentProps) {
  return (
    <>
      <View style={styles.text}>
        <Body style={styles.title}>{title}</Body>
        {message ? <Meta>{message}</Meta> : null}
      </View>
      <View style={styles.actions}>
        <Button label={cancelLabel} onPress={onCancel} style={styles.action} />
        <Button label={confirmLabel} onPress={onConfirm} style={styles.action} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.bodyLg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});

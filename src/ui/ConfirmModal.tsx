import { StyleSheet, View } from 'react-native';

import { fontSize, spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Sheet } from './Sheet';
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

type Props = ContentProps & {
  visible: boolean;
  /**
   * Chamado ao tocar fora do painel. Sem ele, fora conta como `onCancel` — o
   * certo para "Remover?", mas errado para uma ESCOLHA ("So hoje" / "Toda
   * segunda"), em que a esquerda tambem e uma resposta e nao um recuo.
   */
  onDismiss?: () => void;
};

/**
 * Pergunta com duas respostas do mesmo tamanho.
 *
 * Os dois botoes sao `secondary`: o destrutivo nao ganha vermelho (cor de
 * estado, §7) nem accent (o accent e da tela, nao de um modal que aparece por
 * cima dela). O que diz o que acontece e o rotulo.
 */
export function ConfirmModal({ visible, onDismiss, ...content }: Props) {
  return (
    <Sheet visible={visible} onClose={onDismiss ?? content.onCancel}>
      <ConfirmContent {...content} />
    </Sheet>
  );
}

/**
 * O miolo da pergunta, sem o modal em volta — para quem ja esta dentro de um
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

import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/theme/tokens';

import { WithoutBlurTarget } from './blurTarget';
import { GlassSurface } from './GlassSurface';
import { useModalAnimation } from './motion';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Painel de vidro que sobe do rodape: a base do `ConfirmModal` e do
 * `ActionSheet`.
 *
 * Mesma receita do `ExercisePicker` — `Modal` transparente, vidro de nivel 3,
 * `WithoutBlurTarget` porque no Android o `Modal` e uma janela propria e o alvo
 * de blur da janela principal nao chega aqui.
 *
 * Nao e `Alert.alert`: o alerta nativo e o unico lugar do app que sairia com a
 * cara do sistema (fundo claro no iOS, botao azul, "destrutivo" em vermelho), e
 * o vermelho e exatamente a cor de estado que o brief proibe.
 *
 * Tocar fora fecha. Nada destrutivo acontece por fechar: a acao so roda no
 * botao que diz o que ela faz.
 */
export function Sheet({ visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const animation = useModalAnimation();

  return (
    <Modal visible={visible} animationType={animation} transparent onRequestClose={onClose}>
      <WithoutBlurTarget>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Fechar"
          />
          <GlassSurface
            borderRadius={radius.card}
            style={[styles.panel, { paddingBottom: insets.bottom + spacing.xl }]}
          >
            {children}
          </GlassSurface>
        </View>
      </WithoutBlurTarget>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  panel: {
    marginHorizontal: spacing.sm,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});

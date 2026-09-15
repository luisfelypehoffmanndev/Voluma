import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/theme/tokens';

import { WithoutBlurTarget } from './blurTarget';
import { GlassSurface } from './GlassSurface';
import { useModalAnimation } from './motion';

/**
 * Teto de espera pelo `onDismiss` do iOS. A animacao de saida do `Modal` dura
 * ~300ms; se o evento nao vier (modal que nem chegou a abrir, fechado no mesmo
 * quadro), a acao roda assim mesmo e nada fica preso.
 */
const DISMISS_FALLBACK_MS = 500;

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Chamado UMA vez depois que o modal terminou de sair da tela.
   *
   * E onde a acao escolhida no painel deve rodar. No iOS, mudar a arvore por
   * baixo enquanto um `Modal` do RN ainda esta saindo — trocar de rota, fechar
   * outro modal, desmontar o dono dele — pode deixar uma camada invisivel por
   * cima do app que engole todo toque. Foi o bug real do "So hoje": o seletor e
   * a pergunta fechavam juntos e a tela parava de responder.
   */
  onDismissed?: () => void;
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
export function Sheet({ visible, onClose, onDismissed, children }: Props) {
  const animation = useModalAnimation();
  const dismissedRef = useRef(onDismissed);
  dismissedRef.current = onDismissed;
  const wasVisible = useRef(visible);
  const fired = useRef(true);

  const fire = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    dismissedRef.current?.();
  }, []);

  useEffect(() => {
    if (visible) {
      fired.current = false;
    } else if (wasVisible.current) {
      // Android nao tem `onDismiss`, e la o `Modal` e uma janela propria que nao
      // prende toque ao sair: pode rodar ja. No iOS o `onDismiss` e quem manda,
      // e o timer so cobre o caso de ele nunca chegar.
      if (Platform.OS !== 'ios') {
        fire();
      } else {
        const timer = setTimeout(fire, DISMISS_FALLBACK_MS);
        wasVisible.current = visible;
        return () => clearTimeout(timer);
      }
    }
    wasVisible.current = visible;
  }, [visible, fire]);

  return (
    <Modal
      visible={visible}
      animationType={animation}
      transparent
      onRequestClose={onClose}
      onDismiss={fire}
    >
      <WithoutBlurTarget>
        <SheetPanel onClose={onClose}>{children}</SheetPanel>
      </WithoutBlurTarget>
    </Modal>
  );
}

/**
 * O fundo escurecido e o painel, sem o `Modal` em volta.
 *
 * Para quem ja esta dentro de um `Modal` (o `ExercisePicker`): um segundo
 * `Modal` aninhado fecha junto com o de fora e e justamente a combinacao que
 * trava o iOS. Aqui a pergunta e so uma camada absoluta por cima do conteudo.
 */
export function SheetPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
      <GlassSurface
        borderRadius={radius.card}
        style={[styles.panel, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {children}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  panel: {
    marginHorizontal: spacing.sm,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});

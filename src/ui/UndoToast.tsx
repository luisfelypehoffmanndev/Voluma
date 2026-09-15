import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { radius, spacing } from '@/theme/tokens';

import { GlassSurface } from './GlassSurface';
import { useFlag } from './motion';
import { PressableSurface } from './PressableSurface';
import { Body } from './Text';

/** Quanto tempo o "Desfazer" fica na tela. Tempo de ler, achar o botao e tocar. */
const UNDO_WINDOW = 5000;

export type UndoOffer = {
  /** Muda a cada oferta, para uma segunda acao reiniciar o prazo. */
  id: number;
  message: string;
  onUndo: () => void;
};

type Props = {
  offer: UndoOffer | null;
  onExpire: () => void;
  bottom: number;
};

/**
 * "Pulado hoje · Desfazer".
 *
 * A alternativa a pedir confirmacao para o que e barato de reverter: perguntar
 * "tem certeza?" antes de toda acao reversivel ensina a tocar em "sim" sem ler,
 * e ai a confirmacao que importa (remover do plano) perde o efeito.
 *
 * Vai no `overlay` do `Screen`, nunca nos filhos: e vidro, e vidro dentro do
 * alvo de blur se leria a si mesmo.
 *
 * Entra e sai por opacidade, atras do portao de `motion.ts`. Com movimento
 * reduzido aparece e some direto — o botao continua funcionando igual.
 */
export function UndoToast({ offer, onExpire, bottom }: Props) {
  // O conteudo fica montado durante a saida: sem isso o texto sumiria no
  // primeiro frame do fade e a pilula esvaziaria antes de apagar.
  const [shown, setShown] = useState(offer);
  const visible = useFlag(offer != null);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!offer) return;
    setShown(offer);
    const timer = setTimeout(() => expireRef.current(), UNDO_WINDOW);
    return () => clearTimeout(timer);
  }, [offer]);

  const style = useAnimatedStyle(() => ({ opacity: visible.value }));

  if (!shown) return null;

  return (
    <Animated.View
      style={[styles.wrap, { bottom }, style]}
      pointerEvents={offer ? 'box-none' : 'none'}
    >
      <GlassSurface borderRadius={radius.pill} style={styles.pill}>
        <Body numberOfLines={1} style={styles.message}>
          {shown.message}
        </Body>
        <PressableSurface
          feedback="solid"
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          onPress={() => {
            shown.onUndo();
            onExpire();
          }}
        >
          <View style={styles.undo}>
            <Body>Desfazer</Body>
          </View>
        </PressableSurface>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
  pill: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  message: {
    flex: 1,
  },
  undo: {
    paddingVertical: spacing.sm,
  },
});

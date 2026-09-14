import type { ReactNode } from 'react';
import { useIsFocused } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';

import { motion } from '@/theme/tokens';
import { useFlag } from './motion';

/**
 * Troca de aba deixa de ser um corte cru: o conteudo da aba que ganha foco
 * acende (opacidade 0 -> 1) exatamente como o TabIcon acende ao lado dela —
 * mesmo gatilho (useFlag), mesma duracao (motion.duration.state), sem
 * introduzir um setimo numero no orcamento de movimento do app.
 *
 * So a ENTRADA anima. A saida nao precisa de tratamento: a aba anterior vira
 * `display: none` no mesmo frame por baixo do react-navigation, entao nunca
 * ha uma transicao de saida visivel para animar.
 *
 * Fica fora de `Screen` de proposito: `Screen` tambem embrulha telas do
 * Stack (day, session, catalog...), que ja tem sua propria transicao nativa
 * (`slide_from_right` etc.) — empilhar um fade do Reanimated por cima delas
 * duplicaria o movimento na mesma troca. So entra nos quatro arquivos de aba.
 */
export function TabScene({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const progress = useFlag(focused, motion.duration.state);
  const style = useAnimatedStyle(() => ({ opacity: progress.value }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

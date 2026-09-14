import type { ReactNode } from 'react';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { motion, tabIcon } from '@/theme/tokens';
import { useFlag } from './motion';

/**
 * Acende o icone da aba em foco e apaga os outros.
 *
 * A alternativa obvia seria interpolar a COR, do `textSecondary` ao
 * `textPrimary`. Custaria caro: os icones montam o `stroke` dentro do
 * `base()` de icons.tsx, entao animar cor exigiria transformar cada `Path`,
 * `Line`, `Rect` e `Circle` dos quatro icones num componente animado do
 * `react-native-svg`. Opacidade num wrapper e uma view por aba, e o §7 do brief
 * ja diz que estado se comunica por "aceso/apagado na mesma matiz" — isto e
 * literalmente isso.
 *
 * Em repouso a aparencia nao muda: `tabIcon.idleOpacity` foi derivado para
 * pousar no mesmo `#8A8A8A` que o inativo tinha como cor.
 */
export function TabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  const progress = useFlag(focused, motion.duration.state);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [tabIcon.idleOpacity, 1]),
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

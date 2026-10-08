import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTour } from '@/store/tour';

/**
 * Embrulha o elemento que o tour aponta e registra onde ele esta.
 *
 * `measureInWindow`, e nao o `y` do `onLayout`: o `onLayout` mede contra o pai
 * (um card dentro de um ScrollView dentro da tela), e o tour desenha em
 * coordenadas de JANELA. Medir depois do layout e o unico jeito de ter as duas
 * no mesmo sistema.
 */
export function TourTarget({
  id,
  children,
  style,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View>(null);
  const register = useTour((state) => state.register);
  const unregister = useTour((state) => state.unregister);

  useEffect(() => () => unregister(id), [id, unregister]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) register(id, { x, y, width, height });
        });
      }}
    >
      {children}
    </View>
  );
}

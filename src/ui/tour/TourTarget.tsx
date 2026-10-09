import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTour } from '@/store/tour';

/** De quanto em quanto tempo a posicao do alvo e conferida com a dica aberta. */
const MEASURE_INTERVAL_MS = 250;

/**
 * Embrulha o elemento que o tour aponta e registra onde ele esta.
 *
 * `measureInWindow`, e nao o `y` do `onLayout`: o `onLayout` mede contra o pai
 * (um card dentro de um ScrollView dentro da tela), e o tour desenha em
 * coordenadas de JANELA. Medir depois do layout e o unico jeito de ter as duas
 * no mesmo sistema.
 *
 * Enquanto a dica daquele alvo esta aberta, a medida se repete: layout nao e
 * evento de rolagem, entao sem isso bastava rolar a tela um dedo para o recorte
 * ficar apontando o lugar errado.
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
  const measuring = useTour((state) => state.measuring === id);

  const measure = useRef(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) useTour.getState().register(id, { x, y, width, height });
    });
  });

  useEffect(() => () => unregister(id), [id, unregister]);

  useEffect(() => {
    if (!measuring) return;
    const tick = measure.current;
    tick();
    const timer = setInterval(tick, MEASURE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [measuring]);

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

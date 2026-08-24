import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { glass, radius } from '@/theme/tokens';

type Props = {
  children?: ReactNode;
  /** Raio das quinas. Deve casar com o do elemento que esta sendo envidracado. */
  borderRadius?: number;
  /** Desliga o brilho especular em superficies onde a borda de cima nao aparece. */
  specular?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Vidro de nivel 3: o chrome que flutua e precisa esconder o que passa por baixo.
 *
 * Duas decisoes aqui merecem explicacao, porque as duas ja foram feitas errado:
 *
 * 1. **O especular e uma borda, nao uma faixa.** O brief pede
 *    `border-image: linear-gradient(rgba(255,255,255,.28), rgba(255,255,255,.04)) 1`
 *    — 1px que e claro na quina de cima e some descendo. A primeira versao
 *    desenhou um retangulo branco de 20px preenchendo o topo da superficie, que
 *    e outra coisa: lia como uma faixa branca chapada, nao como luz. Sem
 *    `border-image` em RN, a traducao fiel e cor por lado — topo com o valor de
 *    cima do gradiente, base com o de baixo, laterais no meio.
 *
 * 2. **Nao ha SVG aqui.** A faixa antiga era um `<Svg>` com `<LinearGradient>`
 *    dentro de um container com `overflow: 'hidden'`, e cobrava caro: o
 *    `react-native-svg` ignora alpha embutido em `stopColor` no Android (o
 *    degrade virava branco opaco), todas as instancias compartilhavam o mesmo
 *    `id="specular"`, e ainda havia o clipping do raio por cima. Borda nativa
 *    nao tem nenhum desses problemas.
 *
 * iOS usa material nativo de verdade. Android usa uma superficie fosca, sem
 * blur: o `experimentalBlurMethod="dimezisBlurView"` do expo-blur e a unica
 * forma de blur real la, e ele quebra — no Android 12+ blura via
 * `RenderEffectBlur`, cujo resultado e um bitmap de HARDWARE, mas a lib monta o
 * frame desenhando a arvore de views num Canvas de SOFTWARE, e o framework
 * lanca `Software rendering doesn't support hardware bitmaps`.
 *
 * Nao use isto num card. Card e nivel 1 e existe justamente para deixar o campo
 * de luz atravessar — ver a escada de densidade em src/theme/tokens.ts.
 */
export function GlassSurface({
  children,
  borderRadius = radius.pill,
  specular = true,
  style,
}: Props) {
  return (
    <View
      style={[
        styles.container,
        specular ? styles.specularBorder : styles.flatBorder,
        { borderRadius },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <>
          <BlurView
            intensity={glass.blurIntensity}
            tint="systemUltraThinMaterialDark"
            blurReductionFactor={glass.blurReductionFactor}
            style={StyleSheet.absoluteFill}
          />
          {/* Preenchimento por cima do blur: da corpo ao vidro sem matar o que esta atras. */}
          <View style={[styles.fill, { borderRadius }]} pointerEvents="none" />
        </>
      ) : (
        // Sem blur para borrar o que passa atras, a superficie precisa ser bem
        // mais fechada — translucida demais viraria texto sobreposto a texto.
        <View style={[styles.fillOpaque, { borderRadius }]} pointerEvents="none" />
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  /** O gradiente do brief, lado a lado: claro em cima, sumindo embaixo. */
  specularBorder: {
    borderTopColor: glass.specularTop,
    borderLeftColor: glass.specularSide,
    borderRightColor: glass.specularSide,
    borderBottomColor: glass.specularBottom,
  },
  /** Sem brilho: borda uniforme, para superficies cuja quina de cima nao aparece. */
  flatBorder: {
    borderColor: glass.border,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: glass.fill,
  },
  fillOpaque: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: glass.fillNoBlur,
  },
});

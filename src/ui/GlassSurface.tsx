import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { glass, radius } from '@/theme/tokens';

import { useBlurTarget } from './blurTarget';

/**
 * O Android so borra do 12 (API 31) para cima.
 *
 * Abaixo disso o expo-blur cai no RenderScript, que e ordens de grandeza mais
 * caro — e a barra e re-lida a cada frame de rolagem. Melhor a laje fosca ali
 * do que uma rolagem aos trancos. O corte fica em JS, e nao no
 * `dimezisBlurViewSdk31Plus` do proprio expo-blur, porque quando nao ha blur o
 * preenchimento e a aresta especular tambem precisam mudar — deixar o nativo
 * decidir sozinho daria um vidro de 10% de branco sobre nada.
 */
const ANDROID_BLURS = Platform.OS === 'android' && Number(Platform.Version) >= 31;

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
 * **A ramificacao nao e por sistema, e por "isto borra?".** Ate a SDK 54 as
 * duas perguntas tinham a mesma resposta: o unico metodo de blur real do
 * Android (`experimentalBlurMethod="dimezisBlurView"`) crashava com
 * `Software rendering doesn't support hardware bitmaps`, entao Android queria
 * dizer sem blur. Na SDK 57 o expo-blur do Android foi reescrito sobre uma API
 * nova — um `BlurTargetView` marca o que deve ser borrado e o vidro o aponta
 * por ref (ver `blurTarget.tsx`) — e o crash saiu junto. Agora borra no
 * Android 12+ com um alvo em maos, e cai no fosco nos outros dois casos:
 * aparelho antigo, ou sub-arvore sem alvo (o `Modal` do `ExercisePicker`).
 *
 * O preenchimento e a aresta seguem a mesma resposta, e por isso os tokens vem
 * em pares: uma aresta calibrada contra material borrado vira contorno branco
 * sobre a laje fosca. Ver a escada de densidade em src/theme/tokens.ts.
 *
 * Nao use isto num card. Card e nivel 1 e existe justamente para deixar o campo
 * de luz atravessar.
 */
export function GlassSurface({
  children,
  borderRadius = radius.pill,
  specular = true,
  style,
}: Props) {
  const target = useBlurTarget();
  const blurs = Platform.OS === 'ios' || (ANDROID_BLURS && target != null);
  const edge = blurs ? styles.specularBorder : styles.specularBorderNoBlur;

  return (
    <View
      style={[styles.container, specular ? edge : styles.flatBorder, { borderRadius }, style]}
    >
      {blurs ? (
        <>
          <BlurView
            intensity={glass.blurIntensity}
            tint="systemUltraThinMaterialDark"
            blurReductionFactor={glass.blurReductionFactor}
            // Os dois so valem no Android; no iOS o material nativo ignora
            // ambos e borra o que estiver atras na tela.
            blurMethod="dimezisBlurView"
            blurTarget={target ?? undefined}
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
  /**
   * O mesmo especular, mais contido, onde nao ha blur.
   *
   * A aresta e lida em relacao ao CORPO do vidro, e o corpo depende do blur:
   * com backdrop borrado ele sobe e a aresta acompanha; sobre a laje quase
   * opaca do fallback a mesma aresta salta e vira contorno. Ver
   * `specularTopNoBlur` em tokens.ts para os numeros.
   */
  specularBorderNoBlur: {
    borderTopColor: glass.specularTopNoBlur,
    borderLeftColor: glass.specularSideNoBlur,
    borderRightColor: glass.specularSideNoBlur,
    borderBottomColor: glass.specularBottomNoBlur,
  },
  /** Sem brilho: borda uniforme, para superficies cuja quina de cima nao aparece. */
  flatBorder: {
    borderColor: glass.border,
  },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: glass.fill,
  },
  fillOpaque: {
    ...StyleSheet.absoluteFill,
    backgroundColor: glass.fillNoBlur,
  },
});

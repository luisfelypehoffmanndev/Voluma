import { Image, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { fieldGrayAt, whiteAlphaFor } from '@/theme/field';
import { colors, glass, radius, surfaces, type LinearGradientLayer } from '@/theme/tokens';

import { useTabBarGeometry } from './tabBar';

/**
 * O fundo do pill da tab bar.
 *
 * Substitui o `GlassSurface` aqui — e so aqui; `FloatingGlassButton` e
 * `ExercisePicker` continuam com ele, e naqueles dois o argumento da opacidade
 * ainda se sustenta.
 *
 * **O problema.** O brief diz que toda superficie e vidro sobre o campo de luz,
 * e que o que separa um nivel do outro e a densidade, nao a materia. A barra era
 * a unica peca do app que desobedecia: com `rgba(34,34,37,0.86)` no Android ela
 * variava 6,4 niveis de cinza ao longo do campo inteiro, contra 43,2 de um card.
 * Ou seja, ela nao amostrava o campo — era uma laje inerte, e ainda por cima
 * tingida de frio (o canal azul e maior que os outros dois), que o §7 proibe.
 *
 * **A saida** esta numa assimetria: o campo e fixo, o conteudo e que rola. Entao
 * a barra nao precisa ser translucida — precisa ser opaca ao conteudo e pintada
 * com o campo que estaria atras dela. Continua escondendo o que passa por baixo,
 * que e a razao de ela ser nivel 3, e volta a respirar junto com o resto.
 *
 * **Por que um gradiente linear resolve.** Medido no pill de uma tela de
 * 393x852dp, o campo anda 10,7 niveis na horizontal e 0,2 na vertical — a ponta
 * esquerda cai dentro do halo `base` (cx 10%, cy 88%), que fica bem em cima da
 * barra. Um gradiente horizontal reproduz isso com erro invisivel, e dispensa
 * remapear os tres radiais para o espaco do pill.
 *
 * **O grao nao e opcional aqui.** A rampa do pill anda 10,7 niveis em ~970px
 * fisicos: sao ~91px por degrau de 8 bits, contra ~34 do campo de tela cheia.
 * O pill banda *mais* que o fundo. E como ele e opaco, o grao do `Ambient` nao
 * o alcanca — precisa do proprio.
 */
/** Onde o pill esta na tela, para amostrar o campo no lugar certo. */
export type PillBox = {
  screenWidth: number;
  screenHeight: number;
  bottom: number;
  height: number;
  sideInset: number;
};

/**
 * O gradiente que reproduz o campo ao longo do pill.
 *
 * E funcao pura de proposito: um `background-image` malformado nao lanca erro —
 * o RN devolve lista vazia e a superficie some sem aviso. Sendo pura, da para
 * rodar o `processBackgroundImage` de verdade em cima dela num teste.
 */
export function pillFieldGradient(box: PillBox): LinearGradientLayer {
  // Fracao da tela e o sistema de coordenadas em que `fieldGrayAt` trabalha.
  const centerY = (box.screenHeight - box.bottom - box.height / 2) / box.screenHeight;
  const startX = box.sideInset / box.screenWidth;
  const endX = (box.screenWidth - box.sideInset) / box.screenWidth;

  return {
    type: 'linear-gradient',
    direction: 'to right',
    colorStops: [
      { color: whiteStop(startX, centerY), positions: ['0%'] },
      { color: whiteStop(endX, centerY), positions: ['100%'] },
    ],
  };
}

export function TabBarSurface() {
  const { width, height } = useWindowDimensions();
  const bar = useTabBarGeometry();

  const field = pillFieldGradient({
    screenWidth: width,
    screenHeight: height,
    bottom: bar.bottom,
    height: bar.height,
    sideInset: bar.sideInset,
  });

  return (
    <View
      style={[
        styles.pill,
        { experimental_backgroundImage: field as unknown as ViewStyle['experimental_backgroundImage'] },
      ]}
    >
      {/* Mesmo ladrilho do `Ambient` — ver `scripts/make-noise.js`. */}
      <Image
        source={require('../../assets/noise.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="repeat"
      />
      {/* O corpo do vidro, por cima do campo pintado e do grao. */}
      <View style={styles.body} pointerEvents="none" />
    </View>
  );
}

/** O stop de gradiente que reproduz o campo naquele ponto. */
function whiteStop(x: number, y: number): string {
  const alpha = Math.max(0, whiteAlphaFor(fieldGrayAt(x, y)));
  return `rgba(255, 255, 255, ${alpha.toFixed(4)})`;
}

const styles = StyleSheet.create({
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    // A rampa dos cards, nao a do vidro. A do vidro (0,28/0,16/0,04) era a borda
    // mais brilhante do app, na peca que fica mais tempo na tela.
    borderTopColor: surfaces.specularTop,
    borderLeftColor: surfaces.specularSide,
    borderRightColor: surfaces.specularSide,
    borderBottomColor: surfaces.specularBottom,
  },
  body: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: glass.fill,
  },
});

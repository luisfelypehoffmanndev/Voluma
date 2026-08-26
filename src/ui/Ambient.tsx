import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { ambientBackground } from '@/theme/tokens';

/**
 * O campo de luz que fica atras de tudo.
 *
 * Toda superficie do app e branco translucido; este e o unico lugar do qual
 * elas tem o que amostrar. Sobre um `#0A0A0A` chapado nao existe luminancia
 * nenhuma, e vidro sem nada por tras e so um retangulo cinza — o brief chama
 * isso de mentira, com razao.
 *
 * Quatro decisoes aqui, todas deliberadas:
 *
 * 1. **Cobre a tela inteira**, e nao so o topo. A versao anterior tinha 320px
 *    de altura, o que bastava enquanto os cards eram solidos; com cards de
 *    vidro, tudo abaixo dos 320px voltaria a ser vidro sobre preto chapado.
 *
 * 2. **Nao rola.** Fica fora do `ScrollView`, entao os cards deslizam por cima
 *    do campo e mudam de luminancia enquanto a lista anda. Essa paralaxe e o
 *    que vende o vidro aqui — mais que o blur, que no Android nem existe (ver
 *    `GlassSurface`).
 *
 * 3. **Os halos sao camada de fundo nativa**, e nao tres `<Rect>` de
 *    `react-native-svg`. Essa e a mudanca que ataca o banding na origem, e nao
 *    o disfarce dele: o `react-native-svg` rasteriza o `<Svg>` inteiro num
 *    bitmap de *software* e nao liga `setDither` em canto nenhum, entao a mesma
 *    rampa era quantizada em 8 bits tres vezes, na CPU, sem dither — e cada
 *    degrau virava um anel. Como fundo nativo, o `BackgroundDrawable` funde os
 *    tres num unico `ComposeShader` e desenha de uma vez no canvas acelerado:
 *    uma quantizacao, na GPU, no pipeline que dithera gradiente.
 *
 *    De quebra some a colisao de ids de gradiente que obrigava um `useId` aqui:
 *    ids de SVG sao globais no `react-native-svg` e as telas de aba ficam
 *    montadas em background, entao duas instancias se pisavam.
 *
 * 4. **O grao por cima.** Mesmo com o gradiente ditherado na GPU, o grao fica:
 *    ele custa pouco e cobre o que sobrar. Ele fica ACIMA dos halos de
 *    proposito — as superficies do app sao translucidas, entao o grao atravessa
 *    para dentro dos cards junto com o resto do campo, e dithera tambem o
 *    gradiente que corre por baixo deles.
 *
 *    O ruido e blue noise com distribuicao triangular, gerado uma vez por
 *    densidade de tela para que o ladrilho caia 1:1 no pixel fisico — ver
 *    `scripts/make-noise.js` para o porque de cada uma das tres coisas.
 *
 * A queda de cada halo vem de `ambient.falloff`, e nao de dois stops: rampa
 * linear para de mudar de golpe no fim do raio, e essa quina na derivada e lida
 * pelo olho como um anel na borda — independente de quantizacao.
 *
 * Fica atras de tudo, sem capturar toque.
 */
export function Ambient() {
  return (
    <View style={styles.field} pointerEvents="none">
      {/* Ver `scripts/make-noise.js` para o que ha dentro do arquivo e como regerar. */}
      <Image
        source={require('../../assets/noise.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="repeat"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFillObject,
    // O tipo publico de `experimental_backgroundImage` no RN 0.81 so descreve
    // `linear-gradient`, embora o runtime e o lado nativo aceitem radial desde
    // a mesma versao. O cast mora aqui, num lugar so; o formato de verdade esta
    // tipado em `RadialGradientLayer`, em `tokens.ts`.
    experimental_backgroundImage:
      ambientBackground as unknown as ViewStyle['experimental_backgroundImage'],
  },
});

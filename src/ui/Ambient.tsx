import { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ambient } from '@/theme/tokens';

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
 * 3. **`stopOpacity`, nunca alpha embutido no `stopColor`.** O
 *    `react-native-svg` ignora alpha dentro de `stopColor` no Android e o
 *    degrade vira branco opaco — o app inteiro clarearia.
 *
 * 4. **O grao por cima.** Um gradiente que anda 22 niveis de cinza ao longo da
 *    tela inteira gasta dezenas de pixels por degrau, e cada degrau aparece
 *    como um anel — banding, e problema de quantizacao de 8 bits, nao de
 *    suavidade. O ruido de ~1 nivel dissolve a fronteira entre os degraus. Ele
 *    fica ACIMA dos halos de proposito: as superficies do app sao translucidas,
 *    entao o grao atravessa para dentro dos cards junto com o resto do campo, e
 *    dithera tambem o gradiente que corre por baixo deles.
 *
 * Fica atras de tudo, sem capturar toque.
 */
export function Ambient() {
  // Ids de gradiente sao globais no react-native-svg, e as telas das abas ficam
  // montadas em background: duas instancias com o mesmo id colidem, e a segunda
  // pinta com o gradiente da primeira. `useId` da um prefixo por instancia; os
  // caracteres nao alfanumericos saem porque o id entra numa referencia
  // `url(#...)`.
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {ambient.halos.map((halo) => (
            <RadialGradient
              key={halo.id}
              id={`${prefix}${halo.id}`}
              cx={halo.cx}
              cy={halo.cy}
              r={halo.r}
            >
              <Stop offset="0" stopColor={ambient.color} stopOpacity={halo.opacity} />
              <Stop offset="1" stopColor={ambient.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        {ambient.halos.map((halo) => (
          <Rect
            key={halo.id}
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${prefix}${halo.id})`}
          />
        ))}
      </Svg>

      {/* Ver `scripts/make-noise.js` para o que ha dentro do arquivo e como regerar. */}
      <Image
        source={require('../../assets/noise.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="repeat"
      />
    </View>
  );
}

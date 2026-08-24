import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ambient } from '@/theme/tokens';

/**
 * Brilho branco radial fraquissimo no topo da tela.
 *
 * Sem isto o vidro fica cinza morto: sobre um fundo `#0A0A0A` chapado, nao ha
 * luminancia nenhuma para o blur capturar, por mais intenso que ele seja. E o
 * unico gradiente permitido fora da borda especular — monocromatico e a 4%,
 * bem abaixo do limiar de "gradiente decorativo" que o brief proibe.
 *
 * Fica atras de tudo, sem capturar toque.
 */
export function Ambient() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width="100%" height={ambient.height}>
        <Defs>
          <RadialGradient id="ambient" cx="50%" cy="0%" r="80%">
            <Stop offset="0" stopColor={ambient.color} stopOpacity={ambient.opacity} />
            <Stop offset="1" stopColor={ambient.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={ambient.height} fill="url(#ambient)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ambient.height,
  },
});

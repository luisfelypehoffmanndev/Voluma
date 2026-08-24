import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { colors, fontSize, fonts } from '@/theme/tokens';

type Props = {
  value: string;
  /** Unidade menor, alinhada pela base do numero — nunca pelo centro. */
  unit?: string;
  size?: number;
  color?: string;
  /**
   * Apaga a unidade para deixar o numero sozinho no protagonismo. Vale sobre
   * superficie escura, onde o branco a 65% vira um cinza neutro de proposito.
   * Sobre o accent tem que vir `false`: preto a 65% sobre laranja nao apaga,
   * suja — vira o marrom acinzentado que aparecia no card de volume.
   */
  dimUnit?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * O numero protagonista da tela. Mono de traco fino (peso 300), sufixo menor
 * encostado na base — como o "190 lbs" e o "3.200 lbs" das referencias.
 *
 * `lineHeight` acompanha o `size` porque a JetBrains Mono deixa folga vertical
 * demais no default do RN, e isso desalinha a unidade.
 */
export function StatNumber({
  value,
  unit,
  size = fontSize.numberLg,
  color = colors.textPrimary,
  dimUnit = true,
  style,
}: Props) {
  const unitSize = Math.max(12, Math.round(size * 0.28));

  return (
    <View style={styles.row}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.value,
          { fontSize: size, lineHeight: size * 1.02, color },
          style,
        ]}
      >
        {value}
      </Text>
      {unit ? (
        <Text
          style={[
            styles.unit,
            { fontSize: unitSize, lineHeight: unitSize * 1.1, color },
            dimUnit ? styles.unitDim : null,
          ]}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: fonts.monoLight,
    letterSpacing: -1,
  },
  unit: {
    fontFamily: fonts.sansMedium,
    marginLeft: 5,
  },
  unitDim: {
    opacity: 0.65,
  },
});

import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * Uma fileira de barras finas, uma por periodo, com uma delas destacada.
 *
 * Serve ao volume por dia e ao volume por semana, para os dois lerem como o
 * mesmo instrumento. A barra ocupa metade da largura do seu espaco e nunca some
 * de todo (2px): um dia sem treino continua marcando o seu lugar na linha do
 * tempo.
 */
type Props = {
  values: readonly number[];
  width: number;
  height?: number;
  /** Indice da barra em destaque; as outras ficam em `dotEmpty`. */
  highlight?: number;
  highlightColor: string;
};

export function BarStrip({ values, width, height = 96, highlight, highlightColor }: Props) {
  const peak = Math.max(1, ...values);
  const barWidth = Math.floor(width / (Math.max(1, values.length) * 2));

  return (
    <View style={[styles.strip, { height }]}>
      {values.map((value, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              width: barWidth,
              height: Math.max(2, (value / peak) * height),
              backgroundColor: index === highlight ? highlightColor : colors.dotEmpty,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bar: {
    borderRadius: 2,
  },
});

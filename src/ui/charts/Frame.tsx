import { StyleSheet, View } from 'react-native';

import { colors, fontSize, spacing } from '@/theme/tokens';
import { Meta, Mono } from '@/ui/Text';

/**
 * A moldura comum dos graficos: a escala a direita e as datas embaixo.
 *
 * A escala mora numa coluna propria, fora da area das marcas, e nao escrita
 * por cima delas: uma barra alta no fim da semana passaria por baixo do numero
 * e os dois ficariam ilegiveis. E so a escala — o valor exato de cada marca
 * continua sendo lido no numero grande do card (ver `useScrub`).
 */

/** Largura da coluna da escala. Cabe "20000" em mono de 12 com folga. */
export const SCALE_WIDTH = 44;

/** Altura de uma linha de texto da escala, para centra-la na linha de grade. */
const LABEL_HEIGHT = 14;

export type ScaleTick = { y: number; label: string };

/**
 * Os numeros da escala, cada um centrado na altura da sua linha de grade.
 * Presos dentro da area do grafico: a linha do topo nao empurra o numero para
 * cima do cabecalho.
 */
export function ScaleLabels({ ticks, height }: { ticks: readonly ScaleTick[]; height: number }) {
  return (
    <View
      style={[styles.scale, { height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {ticks.map((tick, index) => (
        <Mono
          // Pelo indice, nao pelo rotulo: dois valores podem arredondar para o
          // mesmo texto (0,5 e 1 viram "1" em kg inteiro).
          key={index}
          numberOfLines={1}
          style={[
            styles.scaleLabel,
            {
              top: Math.min(height - LABEL_HEIGHT, Math.max(0, tick.y - LABEL_HEIGHT / 2)),
            },
          ]}
        >
          {tick.label}
        </Mono>
      ))}
    </View>
  );
}

/**
 * As pontas do eixo do tempo, alinhadas a area das marcas, e nao ao card: o
 * "hoje" termina embaixo da ultima barra, nao embaixo da escala.
 */
export function ChartFoot({ start, end, width }: { start?: string; end?: string; width: number }) {
  if (!start && !end) return null;
  return (
    <View style={[styles.foot, { width }]}>
      <Meta>{start ?? ''}</Meta>
      <Meta>{end ?? ''}</Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  scale: {
    width: SCALE_WIDTH,
  },
  scaleLabel: {
    position: 'absolute',
    right: 0,
    fontSize: fontSize.label,
    lineHeight: LABEL_HEIGHT,
    color: colors.textSecondary,
  },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});

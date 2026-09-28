import { StyleSheet, View } from 'react-native';

import { colors, fontSize, radius, spacing, surfaces } from '@/theme/tokens';
import { Meta, Mono } from '@/ui/Text';

/**
 * A moldura comum dos graficos: a escala a direita e os meses embaixo.
 *
 * A escala mora numa coluna propria, fora da area das marcas, e nao escrita
 * por cima delas: uma barra alta no fim da semana passaria por baixo do numero
 * e os dois ficariam ilegiveis.
 */

/** Largura da coluna da escala. Cabe "20000" em mono de 12 com folga. */
export const SCALE_WIDTH = 44;

/** Altura de uma linha de texto da escala, para centra-la na linha de grade. */
const LABEL_HEIGHT = 14;

export type ScaleTick = { y: number; label: string };

/**
 * Os numeros da escala, cada um centrado na altura da sua linha de grade.
 * Presos dentro da area do grafico: a linha do topo nao empurra o numero para
 * cima do cabecalho. Dois rotulos que se encostariam ficam so com o primeiro —
 * quem chama poe o mais importante (a media) na frente.
 */
export function ScaleLabels({ ticks, height }: { ticks: readonly ScaleTick[]; height: number }) {
  const placed: { top: number; label: string }[] = [];
  for (const tick of ticks) {
    const top = Math.min(height - LABEL_HEIGHT, Math.max(0, tick.y - LABEL_HEIGHT / 2));
    if (placed.every((other) => Math.abs(other.top - top) >= LABEL_HEIGHT)) {
      placed.push({ top, label: tick.label });
    }
  }

  return (
    <View
      style={[styles.scale, { height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {placed.map((tick, index) => (
        <Mono
          // Pelo indice, nao pelo rotulo: dois valores podem arredondar para o
          // mesmo texto (0,5 e 1 viram "1" em kg inteiro).
          key={index}
          numberOfLines={1}
          style={[styles.scaleLabel, { top: tick.top }]}
        >
          {tick.label}
        </Mono>
      ))}
    </View>
  );
}

/** Largura reservada para um rotulo de mes ("set"), centrado na marca. */
const MONTH_WIDTH = 36;
/** Largura do rotulo da leitura ("semana de 28 set"). */
const CURSOR_WIDTH = 132;
const AXIS_HEIGHT = 22;

export type AxisLabel = { x: number; label: string };

/**
 * O eixo do tempo: o nome de cada mes embaixo da primeira marca dele.
 *
 * Durante a leitura pelo dedo os meses dao lugar a UM rotulo, a data exata do
 * periodo lido, embaixo dele — e o que o leitor quer saber naquele momento, e
 * o dedo nao o cobre, porque fica embaixo do grafico.
 */
export function MonthAxis({
  months,
  width,
  cursor = null,
}: {
  months: readonly AxisLabel[];
  width: number;
  cursor?: AxisLabel | null;
}) {
  return (
    <View
      style={[styles.axis, { width }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {cursor ? (
        <View
          style={[
            styles.cursor,
            { left: clamp(cursor.x - CURSOR_WIDTH / 2, 0, width - CURSOR_WIDTH) },
          ]}
        >
          <Meta numberOfLines={1} style={styles.cursorText}>
            {cursor.label}
          </Meta>
        </View>
      ) : (
        months.map((month) => (
          <Meta
            key={`${month.label}-${month.x}`}
            numberOfLines={1}
            style={[
              styles.month,
              { left: clamp(month.x - MONTH_WIDTH / 2, 0, width - MONTH_WIDTH) },
            ]}
          >
            {month.label}
          </Meta>
        ))
      )}
    </View>
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(low, high), Math.max(low, value));
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
  axis: {
    height: AXIS_HEIGHT,
    marginTop: spacing.sm,
  },
  month: {
    position: 'absolute',
    width: MONTH_WIDTH,
    textAlign: 'center',
  },
  cursor: {
    position: 'absolute',
    width: CURSOR_WIDTH,
    alignItems: 'center',
  },
  cursorText: {
    color: colors.textPrimary,
    backgroundColor: surfaces.raised,
    borderRadius: radius.inner,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
  },
});

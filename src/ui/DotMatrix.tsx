import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { monthBlocks, type DayDot, type DotCell } from '@/domain/streak';
import { monthLabelShort } from '@/domain/week';
import { colors } from '@/theme/tokens';

import { Label } from './Text';

const ROWS = 7;

/**
 * Teto da largura da celula. Quadrada — o espacamento entre quadrados e o
 * mesmo nas duas direcoes, o que faz a grade ler como calendario e nao como
 * fileira de listras.
 *
 * Numa tela de telefone o teto nao chega a pegar: com seis meses sao ~30
 * colunas, e a celula sai em ~8px repartindo a largura do card. Ele existe
 * para tela larga, onde sem limite cada celula viraria um vao enorme em volta
 * de um quadrado de 4px.
 */
const MAX_CELL = 14;

/**
 * Lado do quadrado: pequeno e praticamente fixo. A proporcao entra so como
 * teto de seguranca — em tela estreita a celula encolhe e um valor fixo faria
 * os quadrados se encostarem.
 */
const SQUARE_MAX = 4;
const SQUARE_RATIO = 0.55;

/** Quinas do quadrado: arredondadas o suficiente para nao parecer pixel cru. */
const SQUARE_RADIUS = 1;

/**
 * Respiro entre meses, em celulas. Proporcional a grade, nao um valor fixo em
 * pixels: assim a separacao entre os meses acompanha o tamanho do quadrado e a
 * densidade continua a mesma em qualquer largura de tela.
 */
const BLOCK_GAP_CELLS = 2;

type Props = {
  dots: readonly DayDot[];
  /** Largura disponivel; a celula sai daqui, limitada por `MAX_CELL`. */
  width: number;
  /** Rotulos de mes acima de cada bloco. */
  showMonths?: boolean;
  /**
   * Acende o quadrado de recorde em accent. Deve ficar `false` em telas que ja
   * gastaram seu unico accent em outro elemento — a home, por exemplo, usa o
   * card de volume.
   */
  showRecord?: boolean;
};

/**
 * Historico de treino em grade de quadrados, um bloco por mes: uma coluna por
 * semana, uma linha por dia da semana.
 *
 * O tom de cada quadrado vem da carga daquele dia em relacao ao dia mais
 * pesado da janela — leve quase some no fundo, pesado vem branco. Escala de
 * cinza, com no maximo UM quadrado em accent (o recorde). Nada de heatmap
 * colorido.
 *
 * Toda decisao de posicao vem de `monthBlocks`, que e pura e testada. Aqui so
 * se desenha.
 */
export function DotMatrix({ dots, width, showMonths = true, showRecord = true }: Props) {
  const { blocks, cell, gap } = useMemo(() => {
    const grouped = monthBlocks(dots);
    const totalColumns = grouped.reduce((sum, block) => sum + block.columns, 0);
    if (totalColumns === 0) return { blocks: grouped, cell: 0, gap: 0 };

    // Os vaos entram na conta em unidades de celula, entao a largura inteira e
    // repartida de uma vez so — sem sobra para distribuir depois.
    const units = totalColumns + BLOCK_GAP_CELLS * Math.max(0, grouped.length - 1);
    const sized = Math.min(MAX_CELL, width / units);

    return { blocks: grouped, cell: sized, gap: sized * BLOCK_GAP_CELLS };
  }, [dots, width]);

  const square = Math.min(SQUARE_MAX, cell * SQUARE_RATIO);
  // Centraliza o quadrado na celula: a sobra vira respiro igual dos dois lados.
  const inset = (cell - square) / 2;

  return (
    <View style={[styles.row, { gap }]}>
      {blocks.map((block) => (
        <View key={`${block.year}-${block.month}`}>
          {showMonths ? <Label style={styles.month}>{monthLabelShort(block.month)}</Label> : null}

          <Svg width={block.columns * cell} height={ROWS * cell}>
            {block.cells.map((entry) => (
              <Rect
                key={entry.dateKey}
                x={entry.column * cell + inset}
                y={entry.row * cell + inset}
                width={square}
                height={square}
                rx={SQUARE_RADIUS}
                fill={squareColor(entry, showRecord)}
              />
            ))}
          </Svg>
        </View>
      ))}
    </View>
  );
}

function squareColor(dot: DotCell, showRecord: boolean): string {
  if (dot.record && showRecord) return colors.accent;

  // Indice 0 fica reservado a "sem treino". Um dia treinado, por mais leve que
  // seja, nunca cai nele — senao some no fundo e o dia parece vazio.
  if (!dot.trained) return colors.dotLevels[0];

  const steps = colors.dotLevels.length - 1;
  const level = Math.max(1, Math.ceil(dot.intensity * steps));
  return colors.dotLevels[level];
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Vao uniforme entre os meses, vindo do calculo acima. Nada de
    // `space-between`: com poucos blocos ele abre buracos irregulares e a
    // grade perde a leitura de campo continuo.
    justifyContent: 'center',
  },
  month: {
    height: 18,
    // Centralizado sobre o proprio bloco, como na referencia — nao alinhado a
    // esquerda da coluna em que o mes comeca.
    textAlign: 'center',
  },
});

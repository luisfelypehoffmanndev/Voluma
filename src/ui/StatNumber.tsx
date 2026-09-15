import { StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

import { colors, fontSize, fonts } from '@/theme/tokens';

/**
 * O truque padrao para animar TEXTO sem passar pela JS thread: `Text` nao tem
 * prop animavel de conteudo, `TextInput` tem (`text`), e o Reanimated sabe
 * escreve-la direto da UI thread via `useAnimatedProps`.
 *
 * `text` nao existe no tipo publico de `TextInput` (e uma prop nativa, usada
 * pelo proprio RN internamente para o mesmo fim), entao o cast e inevitavel —
 * e o motivo de ele estar isolado aqui, num lugar so, em vez de espalhado.
 */
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

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
  /**
   * Deixa o numero encolher para caber na largura disponivel.
   *
   * Ligado por padrao — a maioria dos call sites mostra valor de largura
   * imprevisivel dentro de um card estreito. Desligue onde o texto MUDA a cada
   * frame: no Android o `adjustsFontSizeToFit` remede o texto com busca binaria
   * de tamanho a cada troca de conteudo, e numa contagem de 700ms isso vira
   * dezenas de layouts completos de texto. Ver `CountingStat`.
   */
  fit?: boolean;
  style?: StyleProp<TextStyle>;
  /**
   * Quando presente, o NUMERO vem daqui e roda inteiro na UI thread — `value`
   * passa a valer so como texto inicial (o que aparece antes do primeiro
   * quadro, e o que o layout mede).
   *
   * Existe para a contagem do "Volume levantado": animar o numero com
   * `setState` por quadro custava ~42 re-renders em 700ms na JS thread, e
   * qualquer trabalho concorrente ali — a escrita do treino caindo no banco no
   * meio da contagem, por exemplo — aparecia como engasgo. Pela UI thread nada
   * disso a alcanca.
   *
   * O formato e fechado de proposito: inteiro arredondado, a MESMA regra de
   * `formatVolume` (`src/domain/volume.ts`). As duas precisam andar juntas —
   * se aquela voltar a abreviar ou ganhar separador de milhar, esta aqui tem
   * que acompanhar, e ai o worklet deixa de ser uma linha.
   */
  animatedValue?: SharedValue<number>;
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
  fit = true,
  style,
  animatedValue,
}: Props) {
  const unitSize = Math.max(12, Math.round(size * 0.28));
  const valueStyle = [styles.value, { fontSize: size, lineHeight: size * 1.02, color }, style];

  const animatedProps = useAnimatedProps(() => {
    // Mesma regra de `formatVolume` — ver o comentario de `animatedValue`.
    const text = String(Math.round(animatedValue?.value ?? 0));
    return { text, defaultValue: text } as never;
  }, [animatedValue]);

  return (
    <View style={styles.row}>
      {animatedValue ? (
        <AnimatedTextInput
          editable={false}
          // Sem isto o TextInput traz a bagagem de campo de formulario e o
          // numero sai desalinhado da unidade: padding proprio no Android,
          // sublinhado, e a folga de fonte que a `lineHeight` acima ja resolve.
          underlineColorAndroid="transparent"
          scrollEnabled={false}
          defaultValue={value}
          animatedProps={animatedProps}
          style={[valueStyle, styles.animatedValue]}
        />
      ) : (
        <Text numberOfLines={1} adjustsFontSizeToFit={fit} style={valueStyle}>
          {value}
        </Text>
      )}
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
  /**
   * O que separa um `TextInput` de um `Text` na mesma linha de base: o campo
   * vem com padding proprio nos dois lados e, no Android, com a folga de fonte
   * que o `Text` daqui ja neutraliza pela `lineHeight`.
   */
  animatedValue: {
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  unit: {
    fontFamily: fonts.sansMedium,
    marginLeft: 5,
  },
  unitDim: {
    opacity: 0.65,
  },
});

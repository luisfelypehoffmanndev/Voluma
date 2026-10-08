import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { colors, fontSize, fonts } from '@/theme/tokens';

/**
 * Papeis tipograficos do brief. Nada de escolher fonte/tamanho solto nas
 * telas: se um texto nao cabe em um destes, o papel dele nao esta definido.
 */

/** Label de 12–13px em secondary, caixa alta discreta. "Volume levantado". */
export function Label({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.label, style]} />;
}

/** Corpo de 15–16px. Nomes de exercicio, itens de lista. */
export function Body({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.body, style]} />;
}

/** Titulo de tela. Sans medium, nunca bold gordo. */
export function Title({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.title, style]} />;
}

/**
 * Titulo de um bloco dentro da tela: "Treino de hoje", "Progresso".
 *
 * A hierarquia do app vinha so de tamanho de NUMERO; o texto ficava todo entre
 * 12 e 16 e nenhuma tela dizia onde comecar a ler. Este degrau e o que separa
 * "o assunto" de "o conteudo" — e, junto com o `Label` em caixa alta, da nome
 * ao que antes era uma pilha de cards iguais.
 */
export function Section({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.section, style]} />;
}

/** Metadado secundario: "há 31 min", "Sextas". */
export function Meta({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.meta, style]} />;
}

/** Numero em mono — o "ar de instrumento". Peso fino, nunca bold. */
export function Mono({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.mono, style]} />;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.label,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.title,
    color: colors.textPrimary,
    // 30px em sans medium com entrelinha padrao corta acento maiusculo em
    // alguns aparelhos Android; a linha explicita da folga sem mexer no peso.
    lineHeight: 36,
  },
  section: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.section,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: fontSize.labelLg,
    color: colors.textSecondary,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
});

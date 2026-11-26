import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { colors, fontSize, fonts } from '@/theme/tokens';

/**
 * Papeis tipograficos do brief. Nada de escolher fonte/tamanho solto nas
 * telas: se um texto nao cabe em um destes, o papel dele nao esta definido.
 */

/** Rotulo de 12px em caixa alta, cinza auxiliar. "VOLUME", "SÉRIE 3". */
export function Label({ style, ...props }: TextProps) {
  return <RNText maxFontSizeMultiplier={FONT_SCALE_CAP.label} {...props} style={[styles.label, style]} />;
}

/** Corpo de 16px. Nomes de exercicio, itens de lista. O que mais cresce com a fonte do sistema. */
export function Body({ style, ...props }: TextProps) {
  return <RNText maxFontSizeMultiplier={FONT_SCALE_CAP.body} {...props} style={[styles.body, style]} />;
}

/** Titulo de tela. Sans medium, nunca bold gordo. */
export function Title({ style, ...props }: TextProps) {
  return <RNText maxFontSizeMultiplier={FONT_SCALE_CAP.title} {...props} style={[styles.title, style]} />;
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
  return <RNText maxFontSizeMultiplier={FONT_SCALE_CAP.section} {...props} style={[styles.section, style]} />;
}

/** Metadado secundario: "há 31 min", "Sextas". */
export function Meta({ style, ...props }: TextProps) {
  return <RNText maxFontSizeMultiplier={FONT_SCALE_CAP.aux} {...props} style={[styles.meta, style]} />;
}

/** Numero em mono — o "ar de instrumento". Peso fino, nunca bold. */
export function Mono({ style, ...props }: TextProps) {
  return <RNText maxFontSizeMultiplier={FONT_SCALE_CAP.mono} {...props} style={[styles.mono, style]} />;
}

/**
 * O teto do texto do sistema, por papel.
 *
 * O corpo e o que mais cresce: quem pediu fonte grande precisa ler o nome do
 * exercicio. Mas nada cresce sem limite — a primeira versao deixava o corpo
 * livre, e no maior tamanho do iOS (~310%) o nome de 16px virava 50px e sobrava
 * "Su…" ao lado do alvo da serie. Teto de 2x (32px) ainda e o maior texto da
 * tela e cabe na linha. O que ja e grande ou mora numa coluna de largura fixa
 * cresce menos. Ver `design.md` §3.
 */
export const FONT_SCALE_CAP = {
  body: 2,
  /** Rotulo de botao: a caixa tem altura fixa (`BUTTON_HEIGHT`). */
  button: 1.5,
  /** Numero de painel: as leituras dividem a largura em colunas fixas. */
  readout: 1.2,
  label: 1.4,
  aux: 1.6,
  section: 1.4,
  title: 1.3,
  /** Numero mono em linha: a coluna e de largura fixa. */
  mono: 1.4,
} as const;

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.label,
    // Mais aberto que antes (0,4): caixa alta pequena precisa de ar entre as
    // letras para ler como rotulo de instrumento, e nao como texto espremido.
    letterSpacing: 0.8,
    color: colors.textAux,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  title: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.title,
    color: colors.textPrimary,
    // Sans medium grande com entrelinha padrao corta acento maiusculo em
    // alguns aparelhos Android; a linha explicita da folga sem mexer no peso.
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  section: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.section,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: fontSize.aux,
    color: colors.textAux,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
});

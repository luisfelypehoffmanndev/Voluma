import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, layout, simple, spacing } from '@/theme/tokens';

import { CheckIcon } from './icons';

/**
 * A linguagem simples do app (plano 16, ajuste de clareza).
 *
 * Referencia de FORMA: o app Stoic — blocos solidos e arredondados, titulos
 * grandes em negrito, um botao em pilula com verbo, uma faixa com os dias da
 * semana, atalhos quadrados com icone e nome. Cores do Voluma: fundo quase
 * preto, blocos cinza escuro, laranja so no destaque da tela.
 *
 * Existe porque a versao "instrumento" (vidro, mono fino, rotulos cinza) era
 * bonita e ilegivel para quem abria o app pela primeira vez: ninguem sabia por
 * onde comecar. Aqui tudo e grande, solido e diz o que faz.
 */

type PillTone = 'light' | 'accent' | 'dark';

/** Botao em pilula com verbo. `light` e o padrao; `accent` so no destaque. */
export function Pill({
  label,
  onPress,
  tone = 'light',
  icon,
  full = false,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: PillTone;
  icon?: ReactNode;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'accent' ? colors.accent : tone === 'dark' ? colors.bg : simple.pill;
  const fg = tone === 'dark' ? colors.textPrimary : simple.pillText;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pill,
        full && styles.pillFull,
        { backgroundColor: bg, opacity: pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.pillText, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Bloco solido arredondado. Com `onPress`, o bloco inteiro e tocavel. */
export function Block({
  children,
  onPress,
  tone = 'plain',
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** `accent`: o card de destaque da tela, laranja. `plain`: cinza escuro. */
  tone?: 'plain' | 'accent';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const bg = tone === 'accent' ? colors.accent : simple.block;
  if (!onPress) return <View style={[styles.block, { backgroundColor: bg }, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.block,
        { backgroundColor: pressed && tone === 'plain' ? simple.blockPressed : bg },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Titulo grande em negrito: "boa tarde.", "Supino reto". */
export function Big({ children, style, center = false }: { children: ReactNode; style?: StyleProp<any>; center?: boolean }) {
  return (
    <Text style={[styles.big, center && styles.center, style]} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

/** Texto de apoio, cinza claro. */
export function Small({ children, style, center = false }: { children: ReactNode; style?: StyleProp<any>; center?: boolean }) {
  return (
    <Text style={[styles.small, center && styles.center, style]} maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

/**
 * A semana em uma faixa: a letra do dia, e embaixo um ✓ se treinou. Hoje fica
 * dentro de uma caixa. Le-se em um segundo, sem numero nenhum.
 */
export function WeekStrip({
  days,
}: {
  days: readonly { letter: string; trained: boolean; today: boolean; future: boolean }[];
}) {
  return (
    <View style={styles.week} accessible accessibilityLabel={`Semana: treinou ${days.filter((d) => d.trained).length} dias`}>
      {days.map((day, index) => (
        <View key={index} style={[styles.day, day.today && styles.dayToday]}>
          <Text style={[styles.dayLetter, day.future && styles.dayFuture]} maxFontSizeMultiplier={1.2}>
            {day.letter}
          </Text>
          <View style={styles.dayMark}>
            {day.trained ? (
              <CheckIcon size={14} color={colors.textPrimary} strokeWidth={2.2} />
            ) : (
              <View style={[styles.dot, day.future && styles.dayFutureDot]} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Atalho quadrado: icone em cima, nome embaixo. */
export function Tile({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Block onPress={onPress} style={styles.tile} accessibilityLabel={label}>
      {icon}
      <Text style={styles.tileLabel} numberOfLines={2} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Block>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  pillFull: {
    alignSelf: 'stretch',
    height: 58,
  },
  pillText: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
  },
  block: {
    borderRadius: simple.radius,
    padding: layout.cardPadding,
  },
  big: {
    fontFamily: fonts.sansBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textAux,
  },
  center: {
    textAlign: 'center',
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    width: 42,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: simple.radiusSmall - 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayToday: {
    borderColor: colors.textPrimary,
  },
  dayLetter: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  dayFuture: {
    color: colors.textSecondary,
  },
  dayMark: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textAux,
  },
  dayFutureDot: {
    backgroundColor: colors.dotEmpty,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: simple.radiusSmall + 4,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tileLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, glow } from '@/theme/tokens';

type Props = {
  handle: string;
  /** URL assinada da foto, ou null sem foto (ou antes de a URL chegar). */
  uri: string | null;
  /**
   * O caminho da foto no bucket. E a chave do cache: a URL assinada muda a
   * cada hora, o caminho so muda quando a foto muda.
   */
  path?: string | null;
  /** A cor da pessoa (`people`): o anel e o fundo da inicial. */
  color: string;
  size: number;
};

/**
 * A foto de uma pessoa, redonda, com um anel fino e glow na cor dela.
 *
 * Sem foto — ou enquanto a URL assinada nao chega —, a inicial do @ sobre a cor
 * da pessoa: o lugar nunca fica vazio, e a cor continua ligando o rosto as
 * barras dela nos graficos.
 *
 * `expo-image` e nao o `Image` do React Native: guarda em disco, e a mesma foto
 * aparece em quatro cards e na lista de amigos sem baixar cinco vezes.
 */
export const Avatar = memo(function Avatar({ handle, uri, path, color, size }: Props) {
  const ring = Math.max(1, Math.round(size / 18));
  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring,
    borderColor: color,
    // O glow do anel e o `soft` dos graficos: a foto e parte da mesma pessoa.
    boxShadow: `0 0 ${glow.soft.blur * 2}px ${withAlpha(color, glow.soft.opacity)}`,
  };

  return (
    <View
      style={[styles.box, box, uri ? null : { backgroundColor: color }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Foto de @${handle}`}
    >
      {uri ? (
        <Image
          testID="avatar-photo"
          // A chave do cache e o caminho, nao a URL: a URL assinada muda a cada
          // hora, e com ela de chave a mesma foto seria baixada de novo.
          source={{ uri, cacheKey: path ?? undefined }}
          style={styles.photo}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.5 }]} allowFontScaling={false}>
          {initialOf(handle)}
        </Text>
      )}
    </View>
  );
});

function initialOf(handle: string): string {
  return (handle[0] ?? '?').toUpperCase();
}

/** `#RRGGBB` + alpha 0–1 → `#RRGGBBAA`. */
function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${channel}`;
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  initial: {
    // Preto sobre a cor, como o texto sobre o accent (`textOnAccent`): sobre
    // neon, qualquer cinza vira sujo.
    color: colors.textOnAccent,
    fontFamily: fonts.sansMedium,
  },
});

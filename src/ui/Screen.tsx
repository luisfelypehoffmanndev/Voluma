import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hitSlop, radius, spacing, surfaces } from '@/theme/tokens';
import { Ambient } from './Ambient';
import { BlurTarget } from './blurTarget';
import { PressableSurface } from './PressableSurface';
import { Title } from './Text';

/**
 * Base de toda tela. O `Ambient` fica atras de tudo: e o campo de luz que as
 * superficies de vidro amostram — sem ele todas leem como cinza morto.
 *
 * O conteudo mora num filho proprio porque a area segura e dele, nao do campo:
 * filho absoluto se posiciona a partir da borda de padding do pai, entao com o
 * `paddingTop` na raiz o campo comecaria abaixo da barra de status e deixaria
 * uma faixa preta no topo.
 *
 * `overlay` existe por causa do Android. O chrome de vidro que flutua sobre a
 * tela (o botao fixo do rodape) NAO pode morar em `children`: o `BlurTarget` e
 * a sub-arvore que o vidro le para se borrar, e um vidro la dentro se leria a
 * si mesmo. O slot separado e o que o mantem fora do alvo. A caixa de
 * posicionamento nao muda com isso — `content` nao tem padding lateral nem
 * inferior, entao um filho absoluto com `bottom`/`left`/`right` cai no mesmo
 * lugar nos dois pais.
 */
export function Screen({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <BlurTarget style={styles.field}>
        <Ambient />
        <View style={[styles.content, { paddingTop: insets.top }]}>{children}</View>
      </BlurTarget>
      {overlay}
    </View>
  );
}

type HeaderProps = {
  title: string;
  /** Acao a direita: um unico botao redondo, como nos mockups. */
  action?: { icon: ReactNode; onPress: () => void };
  secondaryAction?: { icon: ReactNode; onPress: () => void };
};

/** Cabecalho de tela: titulo a esquerda, acoes redondas a direita. */
export function Header({ title, action, secondaryAction }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Title>{title}</Title>
      <View style={styles.actions}>
        {secondaryAction ? <RoundButton {...secondaryAction} /> : null}
        {action ? <RoundButton {...action} /> : null}
      </View>
    </View>
  );
}

export function RoundButton({ icon, onPress }: { icon: ReactNode; onPress: () => void }) {
  // Acende, como os cards: opacidade sobre superficie translucida apagaria o
  // icone junto.
  return (
    <PressableSurface
      hitSlop={hitSlop}
      onPress={onPress}
      feedback="control"
      borderRadius={radius.pill}
      style={styles.round}
    >
      {icon}
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  /** O alvo de blur ocupa a tela toda: o campo de luz e o conteudo rolavel. */
  field: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaces.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: surfaces.specularTop,
    borderLeftColor: surfaces.specularSide,
    borderRightColor: surfaces.specularSide,
    borderBottomColor: surfaces.specularBottom,
  },
});

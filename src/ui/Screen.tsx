import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hitSlop, radius, spacing, surfaces } from '@/theme/tokens';
import { Ambient } from './Ambient';
import { BlurTarget } from './blurTarget';
import { PressableSurface } from './PressableSurface';
import { Meta, Title } from './Text';
import { ArrowRightIcon } from './icons';

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
  /** Linha de dado sob o titulo — "Segunda · 14 set". Nunca frase de boas-vindas. */
  subtitle?: string;
  /**
   * Botao de voltar: uma seta para a direita, sempre no canto superior direito.
   *
   * Um icone e um lugar so, em toda tela que sai — push ou modal. Antes cada
   * tela escolhia o proprio (chevron, seta para baixo) e o lugar mudava; agora
   * o polegar sempre acha a saida no mesmo ponto.
   */
  back?: boolean;
  /** Quem nao e rota (o painel do `ExercisePicker`) fecha por conta propria. */
  onBack?: () => void;
  /** Acao a direita: um unico botao redondo, como nos mockups. */
  action?: { icon: ReactNode; onPress: () => void; accessibilityLabel?: string };
  secondaryAction?: { icon: ReactNode; onPress: () => void; accessibilityLabel?: string };
};

/** Cabecalho de tela: titulo a esquerda; acoes e o voltar, redondos, a direita. */
export function Header({ title, subtitle, back, onBack, action, secondaryAction }: HeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.lead}>
        <View style={styles.title}>
          <Title numberOfLines={1}>{title}</Title>
          {subtitle ? <Meta numberOfLines={1}>{subtitle}</Meta> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {secondaryAction ? <RoundButton {...secondaryAction} /> : null}
        {action ? <RoundButton {...action} /> : null}
        {back ? (
          <RoundButton
            icon={<ArrowRightIcon size={20} />}
            onPress={onBack ?? (() => router.back())}
            accessibilityLabel="Voltar"
          />
        ) : null}
      </View>
    </View>
  );
}

export function RoundButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  // Acende, como os cards: opacidade sobre superficie translucida apagaria o
  // icone junto.
  return (
    <PressableSurface
      hitSlop={hitSlop}
      onPress={onPress}
      feedback="control"
      borderRadius={radius.pill}
      style={styles.round}
      accessibilityLabel={accessibilityLabel}
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
  lead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flexShrink: 1,
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

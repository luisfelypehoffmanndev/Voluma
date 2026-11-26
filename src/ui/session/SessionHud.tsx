import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, layout, spacing, theme } from '@/theme/tokens';
import { ArrowLeftIcon } from '@/ui/icons';
import { RoundButton } from '@/ui/Screen';
import { Label, Meta } from '@/ui/Text';

type Props = {
  /** O nome do treino — a rotina do dia, ou o dia da semana. */
  title: string;
  /** O exercicio da vez, ou `null` quando tudo foi feito. */
  current: string | null;
  /** "Série 3 de 4" do exercicio da vez. */
  currentSet: string | null;
};

/**
 * O topo da sessao (Design/design.md §7): responde "o que eu faco agora?" num
 * olhar — o exercicio da vez em destaque e a serie em que a pessoa esta. O
 * progresso do treino inteiro fica no rodape, junto do "Finalizar treino".
 */
export function SessionHud({ title, current, currentSet }: Props) {
  const router = useRouter();

  return (
    <View style={styles.hud}>
      <View style={styles.titleRow}>
        <Label numberOfLines={1} style={styles.routine}>
          {title.toUpperCase()}
        </Label>
        <RoundButton
          icon={<ArrowLeftIcon size={20} />}
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
        />
      </View>
      <Text style={styles.exercise} numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {current ?? 'Tudo feito!'}
      </Text>
      <Meta>{current ? (currentSet ?? '') : 'Toque em Finalizar treino para ver o resultado.'}</Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    paddingHorizontal: layout.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  routine: {
    flex: 1,
  },
  exercise: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: theme.onSurface,
  },
});

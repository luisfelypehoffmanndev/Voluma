import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { layout, spacing } from '@/theme/tokens';
import { ArrowLeftIcon } from '@/ui/icons';
import { RoundButton } from '@/ui/Screen';
import { Body, Section } from '@/ui/Text';
import { SetMeter } from '@/ui/SetMeter';

type Props = {
  /** O nome do treino — a rotina do dia, ou o dia da semana se ela nao tem nome. */
  title: string;
  done: number;
  total: number;
  /** O exercicio da vez, para o "Passo 3 de 16 · Supino reto". */
  current: string | null;
};

/**
 * O topo fixo do treino: o nome, o passo em que a pessoa esta e a barra.
 *
 * Sem numeros de painel (series, volume, tempo): um primeiro usuario tinha que
 * decifrar tres leituras antes de saber o que fazer. Agora o topo diz so onde
 * ela esta — "Passo 3 de 16 · Supino reto" — e o resto da tela diz o que fazer.
 */
export function SessionHud({ title, done, total, current }: Props) {
  const router = useRouter();

  return (
    <View style={styles.hud}>
      <View style={styles.titleRow}>
        <Section numberOfLines={2} style={styles.title}>
          {title}
        </Section>
        <RoundButton
          icon={<ArrowLeftIcon size={20} />}
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
        />
      </View>


      {/* Onde a pessoa esta, em palavras: o passo e o exercicio. A barra mostra
          o mesmo de relance — cada traco e uma serie. */}
      <View style={styles.step}>
        <Body numberOfLines={1}>
          {done >= total
            ? 'Tudo feito! Agora toque em Finalizar treino.'
            : `Passo ${done + 1} de ${total}${current ? ` · ${current}` : ''}`}
        </Body>
        <SetMeter done={done} total={total} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    paddingHorizontal: layout.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  step: {
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
});

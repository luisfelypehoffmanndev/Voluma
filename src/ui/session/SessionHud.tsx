import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { elapsedMs, formatClock } from '@/domain/duration';
import { colors, fontSize, fonts, layout, spacing } from '@/theme/tokens';
import { CountingStat } from '@/ui/CountingStat';
import { ArrowLeftIcon } from '@/ui/icons';
import { RoundButton } from '@/ui/Screen';
import { Body, FONT_SCALE_CAP, Label, Mono, Section } from '@/ui/Text';
import { SetMeter } from '@/ui/SetMeter';

type Props = {
  /** O nome do treino — a rotina do dia, ou o dia da semana se ela nao tem nome. */
  title: string;
  done: number;
  total: number;
  /** Volume do dia na tela, `undefined` enquanto a consulta nao respondeu. */
  volume: number | undefined;
  startedAt: string;
  completedAt: string | null;
  /** O exercicio da vez, para o "Passo 3 de 16 · Supino reto". */
  current: string | null;
};

/**
 * O painel fixo do topo do treino: o que e, quanto falta, quanto ja foi.
 *
 * Responde as tres perguntas do meio do treino sem rolar — "quanto falta"
 * (series), "quanto ja fiz" (volume) e "ha quanto tempo" (relogio) — numa linha
 * de leituras de instrumento: rotulo em cima, numero em mono embaixo.
 *
 * **Nasce compacto e nao encolhe ao rolar.** O pedido original era um topo que
 * compacta com a rolagem; isso e animar tamanho, que o §10 proibe. O volume de
 * 56px que ocupava o primeiro quarto da tela desceu para esta linha — o numero
 * heroi da sessao agora e a carga da serie da vez, que e o que a pessoa le
 * entre series. O volume grande continua na tela de resultado.
 */
export function SessionHud({ title, done, total, volume, startedAt, completedAt, current }: Props) {
  const router = useRouter();

  return (
    <View style={styles.hud}>
      <View style={styles.titleRow}>
        <Section numberOfLines={1} style={styles.title}>
          {title}
        </Section>
        <RoundButton
          icon={<ArrowLeftIcon size={20} />}
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
        />
      </View>

      <View style={styles.readouts}>
        <Readout label="SÉRIES">
          <View style={styles.fraction}>
            <Mono style={styles.value} maxFontSizeMultiplier={FONT_SCALE_CAP.readout}>
              {String(done)}
            </Mono>
            <Mono
              style={[styles.value, styles.of]}
              maxFontSizeMultiplier={FONT_SCALE_CAP.readout}
            >{`/${total}`}</Mono>
          </View>
        </Readout>
        <View style={styles.divider} />
        <Readout label="VOLUME">
          <CountingStat kg={volume} size={fontSize.numberLine} />
        </Readout>
        <View style={styles.divider} />
        <Readout label="TEMPO">
          <ElapsedClock startedAt={startedAt} completedAt={completedAt} />
        </Readout>
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

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.readout} accessible accessibilityLabel={label.toLowerCase()}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

/**
 * O relogio do treino, isolado num componente proprio de proposito.
 *
 * Ele muda a cada segundo. Se o tempo morasse no estado da tela, a tela inteira
 * — a lista de cards, as series, a arte dos movimentos — re-renderizaria uma
 * vez por segundo durante o treino todo. Aqui so este texto renderiza.
 *
 * O numero sai sempre da conta `agora − inicio` (`elapsedMs`), nunca de um
 * contador somado: o intervalo do JS para em segundo plano, e um contador
 * voltaria atrasado. Com a conta, voltar ao app mostra o tempo certo no
 * primeiro quadro.
 */
const ElapsedClock = memo(function ElapsedClock({
  startedAt,
  completedAt,
}: {
  startedAt: string;
  completedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (completedAt) return; // treino fechado: o numero nao anda mais
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [completedAt]);

  return (
    <Mono
      style={styles.value}
      maxFontSizeMultiplier={FONT_SCALE_CAP.readout}
      accessibilityLabel={`tempo ${formatClock(elapsedMs(startedAt, completedAt, now))}`}
    >
      {formatClock(elapsedMs(startedAt, completedAt, now))}
    </Mono>
  );
});

const styles = StyleSheet.create({
  hud: {
    paddingHorizontal: layout.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
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
  readouts: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  readout: {
    flex: 1,
    gap: spacing.xs,
  },
  /** Fio de 1px entre as leituras — como os separadores de um painel. */
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },
  fraction: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberLine,
    color: colors.textPrimary,
  },
  of: {
    color: colors.textAux,
  },
});

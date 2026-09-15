import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createPushPullLegs, startEmpty } from '@/db/onboarding';
import { DEFAULT_TRAINING_DAYS, assignCycle } from '@/domain/templates';
import type { Weekday } from '@/domain/types';
import { weekdayInitials, weekdayName } from '@/domain/week';
import { bumpData } from '@/store/data';
import { useOnboarding } from '@/store/onboarding';
import { colors, fontSize, fonts, radius, spacing, surfaces } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirm } from '@/ui/haptics';
import { PressableSurface } from '@/ui/PressableSurface';
import { Reveal } from '@/ui/Reveal';
import { Header, Screen } from '@/ui/Screen';
import { Body, Label, Meta, Mono } from '@/ui/Text';

type Start = 'ppl' | 'empty';

/**
 * Onboarding: explica o app em duas telas e monta o plano em mais uma ou duas.
 *
 * Existe porque a primeira abertura caia numa home com um plano que ninguem
 * escolheu, e nada dizia que o treino se monta em Plano, se registra em Hoje e
 * se compara em Historico.
 *
 * Um accent por tela: o botao de avancar. O dia escolhido e a opcao marcada
 * usam superficie de nivel 2, nunca laranja — dois laranjas brigariam.
 *
 * `?replay=1` (Perfil → "Como o Voluma funciona") mostra so as duas telas de
 * explicacao e volta; nao grava nada.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const replay = useLocalSearchParams<{ replay?: string }>().replay === '1';

  const [step, setStep] = useState(0);
  const [start, setStart] = useState<Start | null>(null);
  const [days, setDays] = useState<Weekday[]>([...DEFAULT_TRAINING_DAYS]);
  const [saving, setSaving] = useState(false);

  // Decidido na montagem, nao a cada render: `complete()` vira o status para
  // `done` enquanto esta tela ainda esta aberta, e o redirect abaixo nao pode
  // disparar no meio do proprio fim do onboarding.
  const firstRun = useRef(useOnboarding.getState().status === 'needed').current;

  // Quantas telas o usuario vai ver, para os pontos de progresso nao mentirem:
  // "do zero" pula a escolha de dias, e a revisao so tem as duas primeiras.
  const total = replay ? 2 : start === 'empty' ? 3 : 4;

  const finish = async (choice: Start) => {
    if (saving) return;
    setSaving(true);
    try {
      if (choice === 'ppl') await createPushPullLegs(days);
      else await startEmpty();
      confirm();
      bumpData();
      useOnboarding.getState().complete();
      // PPL tem treino montado: cai em Hoje. Do zero, a semana esta vazia, e o
      // proximo passo e o Plano.
      router.replace(choice === 'ppl' ? '/' : '/plan');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (weekday: Weekday) =>
    setDays((current) =>
      current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday],
    );

  const footer = (() => {
    switch (step) {
      case 0:
        return <Button variant="primary" label="Começar" onPress={() => setStep(1)} />;
      case 1:
        return replay ? (
          <Button variant="primary" label="Entendi" onPress={() => router.back()} />
        ) : (
          <Button variant="primary" label="Continuar" onPress={() => setStep(2)} />
        );
      case 2:
        return (
          <Button
            variant="primary"
            label={saving ? 'Preparando…' : 'Continuar'}
            disabled={start == null || saving}
            onPress={() => (start === 'empty' ? void finish('empty') : setStep(3))}
          />
        );
      default:
        return (
          <Button
            variant="primary"
            label={
              saving
                ? 'Criando plano…'
                : `Criar plano · ${days.length} ${days.length === 1 ? 'dia' : 'dias'}`
            }
            disabled={days.length === 0 || saving}
            onPress={() => void finish('ppl')}
          />
        );
    }
  })();

  // Montar plano e so para a primeira abertura. Quem ja tem plano e chega aqui
  // (link, rota digitada) vai para a home; a explicacao continua em `?replay=1`.
  if (!replay && !firstRun) return <Redirect href="/" />;

  return (
    <Screen
      overlay={
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Progress step={step} total={total} />
          {footer}
        </View>
      }
    >
      {/* Voltar so a partir da segunda tela: a primeira nao tem de onde vir. Na
          revisao, a primeira tela fecha. */}
      <Header
        title=""
        back={step > 0 || replay}
        onBack={() => (step > 0 ? setStep(step - 1) : router.back())}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* A `key` remonta o `Reveal` a cada passo: o conteudo novo acende, sem
            deslizar — §10, entrar e sair do layout por opacidade. */}
        <Reveal key={step}>
          {step === 0 ? <Welcome /> : null}
          {step === 1 ? <HowItWorks /> : null}
          {step === 2 ? <ChooseStart value={start} onChange={setStart} /> : null}
          {step === 3 ? <ChooseDays days={days} onToggle={toggleDay} /> : null}
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

function Welcome() {
  return (
    <View style={styles.welcome}>
      <Mono style={styles.wordmark}>voluma</Mono>
      <Body style={styles.lead}>O volume do seu treino, semana a semana.</Body>
      <Meta>Volume é repetições × peso — a soma do que você levantou.</Meta>
    </View>
  );
}

const HOW_IT_WORKS = [
  { title: 'Plano', text: 'O que você faz em cada dia da semana. Monta uma vez, vale toda semana.' },
  { title: 'Hoje', text: 'Abra o treino, ajuste as cargas e marque o que fez. O volume soma sozinho.' },
  { title: 'Histórico', text: 'Cada treino finalizado é comparado com o mesmo dia da semana anterior.' },
] as const;

function HowItWorks() {
  return (
    <View style={styles.section}>
      <Body style={styles.heading}>Como funciona</Body>
      <Card>
        {HOW_IT_WORKS.map((item, index) => (
          <View key={item.title} style={[styles.stepRow, index > 0 && styles.divided]}>
            <Mono style={styles.stepNumber}>{index + 1}</Mono>
            <View style={styles.stepText}>
              <Body>{item.title}</Body>
              <Meta>{item.text}</Meta>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const STARTS: { value: Start; title: string; text: string }[] = [
  {
    value: 'ppl',
    title: 'Push / Pull / Legs',
    text: 'Empurrar, puxar e pernas, 5 exercícios por dia. Você escolhe os dias e ajusta as cargas no primeiro treino.',
  },
  {
    value: 'empty',
    title: 'Montar do zero',
    text: 'A semana vazia, com o catálogo de exercícios pronto para escolher.',
  },
];

function ChooseStart({ value, onChange }: { value: Start | null; onChange: (next: Start) => void }) {
  return (
    <View style={styles.section}>
      <Body style={styles.heading}>Como quer começar?</Body>
      <Meta>Dá para mudar tudo depois, na aba Plano.</Meta>
      {STARTS.map((option) => {
        const selected = option.value === value;
        return (
          <PressableSurface
            key={option.value}
            feedback="card"
            borderRadius={radius.card}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
            accessibilityLabel={option.title}
          >
            <View style={styles.optionHead}>
              <Body>{option.title}</Body>
              {/* A marca e borda e preenchimento, nunca cor: o accent da tela e do botao. */}
              <View style={[styles.radio, selected && styles.radioSelected]} />
            </View>
            <Meta>{option.text}</Meta>
          </PressableSurface>
        );
      })}
    </View>
  );
}

function ChooseDays({ days, onToggle }: { days: Weekday[]; onToggle: (weekday: Weekday) => void }) {
  const initials = weekdayInitials();
  const plan = assignCycle(days);
  // Segunda primeiro, como o ciclo e distribuido — ver `assignCycle`.
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

  return (
    <View style={styles.section}>
      <Body style={styles.heading}>Quais dias você treina?</Body>
      <Meta>O ciclo Push, Pull, Legs segue a ordem dos dias marcados.</Meta>

      <View style={styles.days}>
        {order.map((weekday) => {
          const selected = days.includes(weekday);
          return (
            <PressableSurface
              key={weekday}
              feedback="none"
              onPress={() => onToggle(weekday)}
              style={styles.dayCell}
              accessibilityLabel={`${weekdayName(weekday)}${selected ? ', marcado' : ''}`}
            >
              <View style={[styles.day, selected && styles.daySelected]}>
                <Label style={selected ? styles.dayLabelSelected : undefined}>
                  {initials[weekday]}
                </Label>
              </View>
            </PressableSurface>
          );
        })}
      </View>

      {plan.length > 0 ? (
        <Card>
          {plan.map(({ weekday, day }, index) => (
            <View key={weekday} style={[styles.planRow, index > 0 && styles.divided]}>
              <Body style={styles.planDay}>{weekdayName(weekday)}</Body>
              <Meta numberOfLines={1} style={styles.planName}>
                {day.name}
              </Meta>
            </View>
          ))}
        </Card>
      ) : (
        <Meta style={styles.none}>Marque pelo menos um dia.</Meta>
      )}
    </View>
  );
}

/** Pontos de progresso: o passo atual aceso, os outros apagados. Mesma forma, sem animar tamanho. */
function Progress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progress} accessibilityLabel={`Passo ${step + 1} de ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    gap: spacing.lg,
  },
  welcome: {
    paddingTop: spacing.xxxl * 2,
    gap: spacing.md,
  },
  wordmark: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberXl,
    color: colors.textPrimary,
  },
  lead: {
    fontSize: fontSize.title,
  },
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: fontSize.title,
    marginBottom: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  stepNumber: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberSm,
    color: colors.textSecondary,
    width: 20,
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  option: {
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: surfaces.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  optionSelected: {
    backgroundColor: surfaces.raised,
    borderColor: colors.borderStrong,
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /** Celula marcavel e quadrado de cantos arredondados (§6), mesmo aqui. */
  radio: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  radioSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  dayCell: {
    alignItems: 'center',
  },
  day: {
    width: 40,
    height: 40,
    borderRadius: radius.square,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  daySelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  dayLabelSelected: {
    color: colors.bg,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  planDay: {
    width: 80,
  },
  planName: {
    flex: 1,
  },
  none: {
    paddingTop: spacing.md,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: colors.dotEmpty,
  },
  dotActive: {
    backgroundColor: colors.dotFilled,
  },
});

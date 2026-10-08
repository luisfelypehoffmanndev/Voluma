import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spotlight, type Rect } from '@/domain/tour';
import { useTour } from '@/store/tour';
import { colors, fonts, fontSize, radius, spacing, surfaces } from '@/theme/tokens';

import { Button } from '../Button';
import { Body, Label, Mono } from '../Text';

export type TourStep = {
  /** O `id` do `TourTarget` que esta dica aponta. */
  target: string;
  /** Uma frase. Duas ja e parede de texto em cima do app. */
  text: string;
};

/** As barras do icone, em miniatura: a dica e do Voluma, nao de um balao genérico. */
const MARK = [0.4, 0.62, 0.3, 0.78, 1] as const;

/**
 * A dica da primeira visita: escurece a tela, deixa UM elemento aceso e diz
 * numa frase o que ele faz.
 *
 * O app tinha o problema oposto do excesso: nada dizia o que fazer em cada
 * tela. A resposta nao e enfeitar a interface de instrucoes — e mostrar uma
 * vez, no lugar certo, e nunca mais.
 *
 * Tres decisoes que a primeira versao errou:
 *
 * 1. **Foco.** Sem `useIsFocused`, a dica da Hoje continuava montada quando o
 *    usuario trocava de aba e reaparecia por cima do Historico, apontando uma
 *    posicao que ja nao existia ali.
 * 2. **Posicao.** O painel era ancorado no alvo. Alvo alto (a semana inteira do
 *    Plano) nao deixa espaco, e o texto saia cortado no topo da tela. Agora ele
 *    mora na METADE OPOSTA a do alvo, dentro da area segura — sempre inteiro.
 * 3. **Identidade.** Era texto solto num retangulo. Agora tem a marca de
 *    barras, o rotulo em mono e o contorno em accent ligando a dica ao
 *    elemento aceso.
 *
 * **Nao e um `Modal`.** A primeira versao era, e deixava a tela preta ao
 * fechar: desmontar um `Modal` do RN que ainda esta visivel — que e o que
 * acontece quando o componente simplesmente para de renderizar — pode deixar a
 * janela nativa pendurada por cima do app, no iOS e no Android. E a mesma
 * familia do bug que travou o "So hoje" (ver `Sheet.tsx`). Como a dica nao
 * precisa de janela propria (nao ha vidro nem teclado aqui), ela e uma camada
 * absoluta dentro da propria tela, que monta e desmonta como qualquer View.
 *
 * A barra de abas fica POR CIMA da camada, de proposito: ela nao e o assunto
 * da dica, e trocar de aba no meio continua sendo um jeito legitimo de sair.
 */
export function Tour({
  id,
  steps,
  active,
}: {
  /** A tela ("home", "plan", "session"): e por ela que o "ja vi" e guardado. */
  id: string;
  steps: readonly TourStep[];
  /**
   * So mostra quando a tela esta pronta: com o dado carregado. O foco e
   * checado aqui dentro, porque esquecer dele foi o bug da primeira versao.
   */
  active: boolean;
}) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const seen = useTour((state) => state.seen[id]);
  const ready = useTour((state) => state.ready);
  const targets = useTour((state) => state.targets);
  const markSeen = useTour((state) => state.markSeen);

  const [step, setStep] = useState(0);
  // Sair de foco no meio do tour volta ao primeiro passo. Derivado no render,
  // e nao num efeito: `setState` em efeito custa render em cascata e o ESLint
  // do projeto o proibe — o mesmo padrao de `UndoToast` e do card de forca.
  const [wasActive, setWasActive] = useState(active && focused);
  const live = active && focused;
  if (live !== wasActive) {
    setWasActive(live);
    if (!live) setStep(0);
  }

  const current = steps[step];
  const rect = current ? targets[current.target] : undefined;
  const showing = live && ready && !seen && rect != null && current != null;

  // No Android o voltar fecha a dica, em vez de sair da tela por tras dela.
  useEffect(() => {
    if (!showing) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      markSeen(id);
      return true;
    });
    return () => subscription.remove();
  }, [showing, id, markSeen]);

  if (!showing || !rect || !current) return null;

  const { bars, hole, above } = spotlight(rect, { width: screen.width, height: screen.height });
  const last = step === steps.length - 1;
  const finish = () => markSeen(id);

  return (
    // `pointerEvents="box-none"` no container: as faixas escuras engolem o
    // toque (para nao se tocar no que esta escondido), e o resto passa.
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Quatro faixas, e nao uma mascara: `overflow` com buraco exigiria SVG
          ou duas camadas compostas, e isto e so posicao — a mesma conta que
          `spotlight` testa. */}
      <View style={[styles.bar, frame(bars.top)]} />
      <View style={[styles.bar, frame(bars.bottom)]} />
      <View style={[styles.bar, frame(bars.left)]} />
      <View style={[styles.bar, frame(bars.right)]} />

      <View style={[styles.ring, frame(hole)]} pointerEvents="none" />

      {/* O painel vai na metade OPOSTA a do alvo, dentro da area segura: assim
          ele nunca depende da altura do elemento apontado para caber. */}
      <View
        style={[
          styles.wrap,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xxl,
            justifyContent: above ? 'flex-start' : 'flex-end',
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.panel}>
          <View style={styles.head}>
            <View style={styles.mark}>
              {MARK.map((height, index) => (
                <View
                  key={index}
                  style={[
                    styles.markBar,
                    { height: 14 * height },
                    index === MARK.length - 1 && styles.markBarLast,
                  ]}
                />
              ))}
            </View>
            <Label>COMO FUNCIONA</Label>
            {steps.length > 1 ? (
              <Mono style={styles.counter}>{`${step + 1}/${steps.length}`}</Mono>
            ) : null}
          </View>

          <Body style={styles.text}>{current.text}</Body>

          <View style={styles.actions}>
            {last ? null : (
              <Button variant="inline" label="Pular" onPress={finish} style={styles.action} />
            )}
            <Button
              variant="inline"
              label={last ? 'Entendi' : 'Próximo'}
              onPress={() => (last ? finish() : setStep(step + 1))}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * `Rect` em estilo de posicao absoluta.
 *
 * Nao e cosmetico: no React Native `x`/`y` NAO sao propriedades de estilo —
 * passa-las e silenciosamente ignorado, e toda faixa cai em `left: 0, top: 0`.
 * Foi esse o bug do recorte aparecendo em volta da barra de status em vez do
 * elemento apontado.
 */
function frame(rect: Rect) {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    // Acima de tudo o que a tela desenha, inclusive do `overlay` do `Screen`
    // (a barra de finalizar do treino).
    zIndex: 10,
    /*
      `elevation` e o `zIndex` do Android, e ele nao e redundante aqui: la a
      ordem de desenho entre irmaos e decidida pela elevacao, e o botao primario
      da Hoje tem a sua (o glow do accent). Sem este valor acima do dele, a
      dica ficaria ATRAS do botao que ela aponta. Nao cobre o elemento aceso —
      o buraco das faixas continua sendo buraco.
    */
    elevation: 24,
  },
  bar: {
    position: 'absolute',
    // Escurece sem apagar: a tela atras continua reconhecivel, e e isso que
    // liga a dica ao lugar dela.
    backgroundColor: 'rgba(10,10,10,0.86)',
  },
  /**
   * O contorno do elemento aceso, em accent.
   *
   * E o unico accent da dica, e ele aponta o mesmo elemento que o usuario vai
   * tocar — na Hoje, o proprio botao laranja. Nao sao dois destaques
   * competindo (§2): sao o mesmo.
   */
  ring: {
    position: 'absolute',
    borderRadius: radius.inner,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  wrap: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: spacing.xl,
  },
  panel: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: surfaces.specularTop,
    borderLeftColor: surfaces.specularSide,
    borderRightColor: surfaces.specularSide,
    borderBottomColor: surfaces.specularBottom,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** A marca em miniatura: as barras da semana, com hoje em accent. */
  mark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
  },
  markBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.textSecondary,
  },
  markBarLast: {
    backgroundColor: colors.accent,
  },
  counter: {
    marginLeft: 'auto',
    fontFamily: fonts.monoLight,
    fontSize: fontSize.label,
    color: colors.textSecondary,
  },
  text: {
    fontSize: fontSize.section,
    lineHeight: 26,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  action: {
    flex: 1,
  },
});

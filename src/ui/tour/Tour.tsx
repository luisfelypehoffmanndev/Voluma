import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spotlight, type Rect } from '@/domain/tour';
import { useTour } from '@/store/tour';
import { colors, fonts, fontSize, radius, spacing, surfaces } from '@/theme/tokens';

import { useTabBarClearance } from '../tabBar';
import { Button } from '../Button';
import { Body, Label, Mono } from '../Text';

export type TourStep = {
  /** O `id` do `TourTarget` que esta dica aponta. */
  target: string;
  /** Uma frase. Duas ja e parede de texto em cima do app. */
  text: string;
};

/** As barras do icone, em miniatura: a dica e do Voluma, nao de um balao generico. */
const MARK = [0.4, 0.62, 0.3, 0.78, 1] as const;

/**
 * Altura ate a qual o recorte e lido como pilula.
 *
 * Acima disso o alvo e um bloco (um card, a semana inteira) e o raio e o de
 * card. O numero e a altura do botao do app mais o respiro do recorte.
 */
const PILL_MAX_HEIGHT = 80;

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
 *    barras, o rotulo em mono e o contorno ligando a dica ao elemento aceso.
 *
 * **Sem accent nenhum.** A dica aparece POR CIMA de uma tela que ja gastou o
 * seu unico destaque (§2) — na Hoje, o proprio botao; no treino, as caixas de
 * concluido. Pintar o contorno de laranja acrescentaria um segundo. O recorte
 * destaca por luz: o resto da tela escurece e o elemento continua aceso.
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
  const insets = useSafeAreaInsets();
  // A barra de abas flutua por cima da tela, e o painel nao pode nascer debaixo
  // dela: era a barra cobrindo o "Entendi". A mesma folga que todo conteudo
  // rolavel do app ja usa.
  const clearance = useTabBarClearance();
  const focused = useIsFocused();
  const setMeasuring = useTour((state) => state.setMeasuring);

  /**
   * Onde esta camada comeca, e que tamanho ela tem — medido, nao assumido.
   *
   * O alvo e medido em coordenadas de JANELA (`measureInWindow`), e a camada
   * desenha em coordenadas DELA. Assumir que as duas coincidem foi o que pos o
   * enquadramento fora do lugar no aparelho: basta a camada comecar abaixo da
   * barra de status para tudo escorregar junto. Subtraindo a origem medida, a
   * conta passa a valer em qualquer aparelho e nas duas plataformas.
   */
  const overlayRef = useRef<View>(null);
  const [frameBox, setFrameBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
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

  // Avisa o `TourTarget` para se remedir enquanto a dica esta aberta — a
  // posicao muda com a rolagem, e layout nao e evento de rolagem.
  useEffect(() => {
    if (!showing || !current) return;
    setMeasuring(current.target);
    return () => setMeasuring(null);
  }, [showing, current, setMeasuring]);

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

  // Do sistema da janela para o desta camada.
  const local = { ...rect, x: rect.x - frameBox.x, y: rect.y - frameBox.y };
  // Antes da primeira medida nao ha onde desenhar: a camada monta vazia por um
  // quadro, em vez de piscar um recorte no lugar errado.
  const measured = frameBox.width > 0 && frameBox.height > 0;
  const { bars, hole, above } = spotlight(local, {
    width: frameBox.width,
    height: frameBox.height,
  });
  const last = step === steps.length - 1;
  const finish = () => markSeen(id);

  return (
    // `pointerEvents="box-none"` no container: as faixas escuras engolem o
    // toque (para nao se tocar no que esta escondido), e o resto passa.
    <View
      ref={overlayRef}
      collapsable={false}
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        overlayRef.current?.measureInWindow((x, y) => {
          setFrameBox((previous) =>
            previous.x === x &&
            previous.y === y &&
            previous.width === width &&
            previous.height === height
              ? previous
              : { x, y, width, height },
          );
        });
      }}
    >
      {measured ? (
      <>
      {/* Quatro faixas, e nao uma mascara: `overflow` com buraco exigiria SVG
          ou duas camadas compostas, e isto e so posicao — a mesma conta que
          `spotlight` testa. */}
      <View style={[styles.bar, frame(bars.top)]} />
      <View style={[styles.bar, frame(bars.bottom)]} />
      <View style={[styles.bar, frame(bars.left)]} />
      <View style={[styles.bar, frame(bars.right)]} />

      {/* O raio acompanha a forma do que esta sendo apontado: pilula no botao,
          raio de card no bloco. Contorno quadrado em volta de um botao redondo
          seria raio inconsistente entre elementos do mesmo nivel (§11). */}
      <View
        style={[
          styles.ring,
          frame(hole),
          { borderRadius: hole.height <= PILL_MAX_HEIGHT ? radius.pill : radius.card },
        ]}
        pointerEvents="none"
      />

      {/* O painel vai na metade OPOSTA a do alvo, dentro da area segura: assim
          ele nunca depende da altura do elemento apontado para caber. */}
      <View
        style={[
          styles.wrap,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: clearance,
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
      </>
      ) : null}
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
  /** O contorno do elemento aceso: branco, pelo §2 — ver a nota no topo. */
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
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
  /** A marca em miniatura: as sete barras da semana, aqui em cinco. */
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
  /**
   * A ultima barra e a de hoje no icone, e la ela e laranja. Aqui ela e branca:
   * a dica nao pode acrescentar accent a uma tela que ja tem o seu (§2). A
   * forma — cinco barras de alturas desiguais — ja basta para a marca.
   */
  markBarLast: {
    backgroundColor: colors.textPrimary,
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

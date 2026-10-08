import { useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';

import { spotlight } from '@/domain/tour';
import { useTour } from '@/store/tour';
import { colors, radius, spacing, surfaces } from '@/theme/tokens';

import { Button } from '../Button';
import { useModalAnimation } from '../motion';
import { Body, Meta } from '../Text';

export type TourStep = {
  /** O `id` do `TourTarget` que esta dica aponta. */
  target: string;
  /** Uma frase. Duas ja e parede de texto em cima do app. */
  text: string;
};

/**
 * A dica da primeira visita: escurece a tela, deixa UM elemento aceso e diz
 * numa frase o que ele faz.
 *
 * O app tinha o problema oposto do excesso: nada dizia o que fazer em cada
 * tela. A resposta nao e enfeitar a interface de instrucoes — e mostrar uma
 * vez, no lugar certo, e nunca mais.
 *
 * Regras que isto respeita: uma frase por passo, no maximo dois passos por
 * tela, e `Pular` sempre disponivel. O recorte nao usa accent — o elemento
 * aceso ja e o destaque, e na Hoje ele proprio e o botao laranja.
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
   * So mostra quando a tela esta pronta: em foco e com o dado carregado. Sem
   * isso a dica aponta para um elemento que ainda nao existe.
   */
  active: boolean;
}) {
  const screen = useWindowDimensions();
  const animation = useModalAnimation();
  const seen = useTour((state) => state.seen[id]);
  const ready = useTour((state) => state.ready);
  const targets = useTour((state) => state.targets);
  const markSeen = useTour((state) => state.markSeen);

  const [step, setStep] = useState(0);
  // Sair de foco no meio do tour volta ao primeiro passo. Derivado no render,
  // e nao num efeito: `setState` em efeito custa render em cascata e o ESLint
  // do projeto o proibe — o padrao do "valor anterior em estado" e o mesmo de
  // `UndoToast` e do card de forca.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setStep(0);
  }

  const current = steps[step];
  const rect = current ? targets[current.target] : undefined;
  const visible = active && ready && !seen && rect != null;

  if (!visible || !rect || !current) return null;

  const { bars, hole, above } = spotlight(rect, { width: screen.width, height: screen.height });
  const last = step === steps.length - 1;

  const finish = () => markSeen(id);

  return (
    <Modal visible transparent animationType={animation} onRequestClose={finish}>
      {/* Quatro faixas, e nao uma mascara: `overflow` com buraco exigiria SVG
          ou duas camadas compostas, e isto e so posicao — a mesma conta que
          `spotlight` testa. */}
      <View style={[styles.bar, bars.top]} />
      <View style={[styles.bar, bars.bottom]} />
      <View style={[styles.bar, bars.left]} />
      <View style={[styles.bar, bars.right]} />

      {/* O contorno em volta do elemento aceso: branco, nao accent — o accent
          da tela tem dono, e as vezes o dono e justamente este elemento. */}
      <View style={[styles.ring, hole]} pointerEvents="none" />

      <View
        style={[
          styles.panel,
          above
            ? { bottom: screen.height - hole.y + spacing.md }
            : { top: hole.y + hole.height + spacing.md },
        ]}
      >
        <Body>{current.text}</Body>
        {steps.length > 1 ? (
          <Meta>{`${step + 1} de ${steps.length}`}</Meta>
        ) : null}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    // Escurece sem apagar: a tela atras continua reconhecivel, e e isso que
    // liga a dica ao lugar dela.
    backgroundColor: 'rgba(10,10,10,0.82)',
  },
  ring: {
    position: 'absolute',
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  /**
   * A dica mora numa superficie propria, nao solta sobre o escurecido.
   *
   * Sem fundo, o texto cai em cima do conteudo da tela que continua visivel
   * por tras do escurecido — a primeira versao tinha "Cadeira flexora"
   * atravessando a frase. Fundo `bg` e nao vidro: dentro de um `Modal` o vidro
   * nao tem o que borrar (ver `blurTarget.tsx`), e aqui o papel e justamente
   * esconder o que passa por baixo.
   */
  panel: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: surfaces.specularTop,
    borderLeftColor: surfaces.specularSide,
    borderRightColor: surfaces.specularSide,
    borderBottomColor: surfaces.specularBottom,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  action: {
    flex: 1,
  },
});

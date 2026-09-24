import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  scrollTo,
  useAnimatedStyle,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { alphaOf, grayHex, grayOf, overlayAlpha, stack } from '@/theme/composite';
import { colors, motion, radius, surfaces } from '@/theme/tokens';
import { confirm } from './haptics';
import { useListMotion, useTiming } from './motion';

/**
 * Lista de cards que se reordena segurando e arrastando — ver Design/design.md §10.
 *
 * **Feita a mao, e em fluxo normal, de proposito.** A primeira versao usava
 * `react-native-sortables`, que posiciona cada item em absoluto e so move os
 * vizinhos depois de MEDIR o item que mudou. Abrir um card de forca (que cresce
 * com as series) virava: o card cresce na hora, por cima dos de baixo, e so
 * depois eles escorregam. Aqui os itens continuam no fluxo, com o mesmo
 * `useListMotion` de antes — abrir um card empurra os vizinhos no mesmo quadro —
 * e o arraste mexe so em `translateY`.
 *
 * O resto do §10: nada cresce (o card levantado *acende*, ver `LIFT_FILL`), nenhuma
 * mola (so `withTiming` com a curva unica, via `useTiming`, que ja zera a
 * duracao com "reduzir movimento"), e um unico `confirm()` quando o drop grava
 * uma ordem nova.
 */

const ACTIVATION_DELAY_MS = 350;
/** Faixa perto da borda do scroll onde o dedo passa a rolar a lista. */
const AUTO_SCROLL_EDGE_TOP = 80;
/** Maior embaixo: as duas telas tem um botao flutuante cobrindo o rodape. */
const AUTO_SCROLL_EDGE_BOTTOM = 160;
/** px/s com o dedo encostado na borda. */
const AUTO_SCROLL_MAX_SPEED = 900;

type Layout = { y: number; height: number };
type RowMotion = Pick<ComponentProps<typeof Animated.View>, 'entering' | 'exiting' | 'layout'>;

type Props<T> = {
  data: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** So chamado quando a ordem mudou de verdade. */
  onReorder: (keys: string[]) => void;
  /** O `Animated.ScrollView` em volta: rola sozinho quando o card chega na borda. */
  scrollableRef: AnimatedRef<Animated.ScrollView>;
  /** Espaco entre os itens — entra na conta de quanto os vizinhos abrem. */
  gap: number;
};

/** O que cada linha precisa do arraste. Estavel entre renders: gesto recriado no meio derruba o drag. */
type DragContext = {
  keys: SharedValue<string[]>;
  layouts: SharedValue<Record<string, Layout>>;
  active: SharedValue<string | null>;
  from: SharedValue<number>;
  to: SharedValue<number>;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  /** Depois do drop gravado: vizinhos voltam a 0 sem animar, porque o layout ja mudou. */
  instant: SharedValue<boolean>;
  gap: number;
  shiftTiming: WithTimingConfig;
  start: (key: string, absoluteY: number) => void;
  move: (key: string, translationY: number, absoluteY: number) => void;
  drop: (key: string) => void;
};

export function ReorderableList<T>({
  data,
  keyOf,
  renderItem,
  onReorder,
  scrollableRef,
  gap,
}: Props<T>) {
  const timing = useTiming();
  const listMotion = useListMotion();
  const scrollOffset = useScrollOffset(scrollableRef);

  const keys = useSharedValue<string[]>(data.map(keyOf));
  const layouts = useSharedValue<Record<string, Layout>>({});
  const active = useSharedValue<string | null>(null);
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const panY = useSharedValue(0);
  const touchY = useSharedValue(0);
  const scrollStart = useSharedValue(0);
  const lift = useSharedValue(0);
  const settling = useSharedValue(false);
  const instant = useSharedValue(false);

  // Estado React so para o que precisa de render: quem fica por cima (zIndex) e
  // o render do drop, que sai sem transicao de layout (ver `commit`).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const onReorderRef = useRef(onReorder);
  useEffect(() => {
    onReorderRef.current = onReorder;
  });

  const shiftTiming = useMemo(() => timing(motion.duration.state), [timing]);
  const dropTiming = useMemo(() => timing(motion.duration.enter), [timing]);

  /** Recalcula a posicao do card levantado e para onde ele iria se solto agora. */
  const retarget = useCallback(() => {
    'worklet';
    const key = active.get();
    if (key === null) return;
    const all = layouts.get();
    const me = all[key];
    if (!me) return;

    dragY.set(panY.get() + scrollOffset.get() - scrollStart.get());
    const center = me.y + dragY.get() + me.height / 2;
    let target = 0;
    for (const other of keys.get()) {
      if (other === key) continue;
      const box = all[other];
      if (box && box.y + box.height / 2 < center) target += 1;
    }
    to.set(target);
  }, [active, layouts, dragY, panY, scrollOffset, scrollStart, keys, to]);

  const autoScroll = useFrameCallback((frame) => {
    if (active.get() === null || settling.get()) return;
    const box = measure(scrollableRef);
    if (!box) return;

    const y = touchY.get();
    const top = box.pageY + AUTO_SCROLL_EDGE_TOP;
    const bottom = box.pageY + box.height - AUTO_SCROLL_EDGE_BOTTOM;
    let speed = 0;
    if (y < top) {
      speed = -AUTO_SCROLL_MAX_SPEED * Math.min(1, (top - y) / AUTO_SCROLL_EDGE_TOP);
    } else if (y > bottom) {
      speed = AUTO_SCROLL_MAX_SPEED * Math.min(1, (y - bottom) / AUTO_SCROLL_EDGE_BOTTOM);
    }
    if (speed === 0) return;

    const seconds = (frame.timeSincePreviousFrame ?? 16) / 1000;
    scrollTo(scrollableRef, 0, Math.max(0, scrollOffset.get() + speed * seconds), false);
    retarget();
  }, false);

  const onDragChange = useCallback(
    (key: string | null) => {
      setActiveKey(key);
      autoScroll.setActive(key !== null);
    },
    [autoScroll],
  );

  const commit = useCallback(
    (next: string[]) => {
      setCommitting(true);
      onDragChange(null);
      onReorderRef.current(next);
    },
    [onDragChange],
  );

  const start = useCallback(
    (key: string, absoluteY: number) => {
      'worklet';
      // Um drop ainda assentando: o proximo drag espera.
      if (active.get() !== null) return;
      instant.set(false);
      const index = keys.get().indexOf(key);
      active.set(key);
      from.set(index);
      to.set(index);
      panY.set(0);
      dragY.set(0);
      touchY.set(absoluteY);
      scrollStart.set(scrollOffset.get());
      lift.set(withTiming(1, shiftTiming));
      scheduleOnRN(onDragChange, key);
    },
    [active, instant, keys, from, to, panY, dragY, touchY, scrollStart, scrollOffset, lift, shiftTiming, onDragChange],
  );

  const move = useCallback(
    (key: string, translationY: number, absoluteY: number) => {
      'worklet';
      if (active.get() !== key || settling.get()) return;
      panY.set(translationY);
      touchY.set(absoluteY);
      retarget();
    },
    [active, settling, panY, touchY, retarget],
  );

  const drop = useCallback(
    (key: string) => {
      'worklet';
      if (active.get() !== key || settling.get()) return;
      settling.set(true);

      const order = keys.get();
      const all = layouts.get();
      const f = from.get();
      const t = to.get();

      // Ate onde o card vai assentar: a soma do que ele atravessou.
      let offset = 0;
      if (t > f) {
        for (let i = f + 1; i <= t; i += 1) offset += (all[order[i]]?.height ?? 0) + gap;
      } else {
        for (let i = t; i < f; i += 1) offset -= (all[order[i]]?.height ?? 0) + gap;
      }

      // No quadro do drop, nao no fim da animacao: o haptico acompanha a causa.
      if (t !== f) scheduleOnRN(confirm);
      lift.set(withTiming(0, dropTiming));
      dragY.set(
        withTiming(offset, dropTiming, () => {
          if (t === f) {
            active.set(null);
            settling.set(false);
            scheduleOnRN(onDragChange, null);
            return;
          }
          const next = order.filter((candidate) => candidate !== key);
          next.splice(t, 0, key);
          scheduleOnRN(commit, next);
        }),
      );
    },
    [active, settling, keys, layouts, from, to, gap, lift, dropTiming, dragY, onDragChange, commit],
  );

  const joinedKeys = data.map(keyOf).join('\n');

  // A nova ordem chegou ao layout: cada card ja esta onde a animacao o deixou,
  // entao os deslocamentos zeram de uma vez, no mesmo commit.
  useLayoutEffect(() => {
    keys.set(joinedKeys ? joinedKeys.split('\n') : []);
    if (!settling.get()) return;
    instant.set(true);
    active.set(null);
    dragY.set(0);
    settling.set(false);
  }, [joinedKeys, keys, settling, instant, active, dragY]);

  // A transicao de layout volta um quadro depois do drop.
  useEffect(() => {
    if (!committing) return;
    const frame = requestAnimationFrame(() => setCommitting(false));
    return () => cancelAnimationFrame(frame);
  }, [committing]);

  const context = useMemo<DragContext>(
    () => ({ keys, layouts, active, from, to, dragY, lift, instant, gap, shiftTiming, start, move, drop }),
    [keys, layouts, active, from, to, dragY, lift, instant, gap, shiftTiming, start, move, drop],
  );

  // O render do drop sai sem transicao de layout: os cards ja estao no lugar
  // novo pelo `translateY`; animar o frame junto os faria voltar e andar de novo.
  const rowMotion = useMemo<RowMotion>(() => {
    if (!('layout' in listMotion)) return {};
    const { entering, exiting, layout } = listMotion;
    return committing ? { entering, exiting } : { entering, exiting, layout };
  }, [listMotion, committing]);

  return (
    <Animated.View style={{ gap }}>
      {data.map((item) => {
        const key = keyOf(item);
        return (
          <Row
            key={key}
            itemKey={key}
            context={context}
            raised={activeKey === key}
            motion={rowMotion}
          >
            {renderItem(item)}
          </Row>
        );
      })}
    </Animated.View>
  );
}

type RowProps = {
  itemKey: string;
  context: DragContext;
  raised: boolean;
  motion: RowMotion;
  children: ReactNode;
};

function Row({ itemKey, context, raised, motion: rowMotion, children }: RowProps) {
  const { keys, layouts, active, from, to, dragY, lift, instant, gap, shiftTiming, start, move, drop } =
    context;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(ACTIVATION_DELAY_MS)
        .onStart((event) => start(itemKey, event.absoluteY))
        .onUpdate((event) => move(itemKey, event.translationY, event.absoluteY))
        .onFinalize(() => drop(itemKey)),
    [itemKey, start, move, drop],
  );

  const rowStyle = useAnimatedStyle(() => {
    const current = active.get();
    if (current === itemKey) return { transform: [{ translateY: dragY.get() }] };

    let shift = 0;
    if (current !== null) {
      const index = keys.get().indexOf(itemKey);
      const f = from.get();
      const t = to.get();
      const space = (layouts.get()[current]?.height ?? 0) + gap;
      if (f < t && index > f && index <= t) shift = -space;
      else if (t < f && index >= t && index < f) shift = space;
    }
    return {
      transform: [{ translateY: instant.get() ? shift : withTiming(shift, shiftTiming) }],
    };
  });

  const liftStyle = useAnimatedStyle(() => ({
    opacity: active.get() === itemKey ? lift.get() : 0,
  }));

  const onLayout = useCallback(
    ({ nativeEvent: { layout: box } }: LayoutChangeEvent) => {
      const y = box.y;
      const height = box.height;
      layouts.modify((all) => {
        'worklet';
        all[itemKey] = { y, height };
        return all;
      });
    },
    [layouts, itemKey],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        {...rowMotion}
        onLayout={onLayout}
        style={[raised && styles.raised, rowStyle]}
      >
        <Animated.View pointerEvents="none" style={[styles.lift, liftStyle]} />
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * O fundo do card levantado: o tom de `cardPressed` sobre o `bg`, OPACO.
 *
 * Opaco porque o card e vidro a 6%: levantado, ele passa por cima dos vizinhos
 * e o texto deles apareceria atravessando. Fica ATRAS do card — acender e
 * sobre a superficie, nao sobre o texto (mesmo motivo de `PressableSurface`).
 * A camada ja e o composto final de `bg` + a diferenca card→cardPressed, entao
 * o card de 6% por cima pousa exatamente em `cardPressed`.
 */
const LIFT_FILL = grayHex(
  stack(
    grayOf(colors.bg),
    overlayAlpha(alphaOf(surfaces.card), alphaOf(surfaces.cardPressed)),
  ),
);

const styles = StyleSheet.create({
  raised: {
    zIndex: 1,
  },
  lift: {
    ...StyleSheet.absoluteFill,
    backgroundColor: LIFT_FILL,
    borderRadius: radius.card,
  },
});

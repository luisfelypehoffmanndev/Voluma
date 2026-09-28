import {
  BlurMask,
  Canvas,
  DashPathEffect,
  Group,
  LinearGradient,
  Path,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { glow } from '@/theme/tokens';

import type { GlowPath, GlowRect, GlowShape } from './shapes';

type Props = {
  shapes: readonly GlowShape[];
  width: number;
  height: number;
};

const STROKE = 1;

/**
 * Quanto o canvas passa da caixa do grafico, de cada lado: o glow vaza da
 * marca, e um canvas do tamanho exato da caixa cortaria a luz num retangulo
 * reto. Tres sigmas do glow mais forte cobrem o borrao inteiro.
 */
const BLEED = Math.ceil(glow.strong.blur * 3);

/**
 * Desenha marcas de grafico com glow — a copia borrada atras, a marca nitida
 * por cima, na cor da pessoa. Retangulos e caminhos (ver `GlowShape`); as
 * linhas de grade tambem passam por aqui, sem glow, para o grafico inteiro
 * ser um canvas so.
 *
 * Skia, e nao SVG, pelo mesmo motivo do `Ambient`: o blur do `react-native-svg`
 * depende do rasterizador de cada sistema, e o do Skia e o mesmo nos dois.
 *
 * O canvas fica ABSOLUTO e maior que a caixa (`BLEED`), sem ocupar layout: quem
 * usa isto reserva so `width x height`, e a luz transborda por cima dos vizinhos
 * sem empurrar nada.
 *
 * `memo`: as formas so mudam quando o dado ou a leitura mudam.
 */
export const GlowCanvas = memo(function GlowCanvas({ shapes, width, height }: Props) {
  return (
    <View style={{ width, height }} pointerEvents="none">
      <Canvas
        style={[
          styles.canvas,
          { width: width + BLEED * 2, height: height + BLEED * 2 },
        ]}
      >
        <Group transform={[{ translateX: BLEED }, { translateY: BLEED }]}>
          {shapes.map((shape, index) =>
            shape.glow === 'none' ? null : (
              <Mark key={`glow-${index}`} shape={shape} opacity={glow[shape.glow].opacity}>
                <BlurMask blur={glow[shape.glow].blur} style="normal" />
              </Mark>
            ),
          )}
          {shapes.map((shape, index) => (
            <Mark key={index} shape={shape} opacity={1} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
});

function Mark({
  shape,
  opacity,
  children,
}: {
  shape: GlowShape;
  opacity: number;
  children?: React.ReactNode;
}) {
  const alpha = opacity * (shape.opacity ?? 1);
  return shape.kind === 'path' ? (
    <PathMark shape={shape} opacity={alpha}>
      {children}
    </PathMark>
  ) : (
    <RectMark shape={shape} opacity={alpha}>
      {children}
    </RectMark>
  );
}

function RectMark({
  shape,
  opacity,
  children,
}: {
  shape: GlowRect;
  opacity: number;
  children?: React.ReactNode;
}) {
  // Contorno por dentro da caixa: meia linha para dentro, senao o quadrado
  // vazado pareceria maior que o cheio ao lado.
  const inset = shape.style === 'stroke' ? STROKE / 2 : 0;
  return (
    <RoundedRect
      x={shape.x + inset}
      y={shape.y + inset}
      width={shape.w - inset * 2}
      height={shape.h - inset * 2}
      r={shape.r}
      color={shape.color}
      opacity={opacity}
      style={shape.style}
      strokeWidth={shape.style === 'stroke' ? STROKE : 0}
    >
      {shape.dash ? <DashPathEffect intervals={shape.dash} /> : null}
      {children}
    </RoundedRect>
  );
}

function PathMark({
  shape,
  opacity,
  children,
}: {
  shape: GlowPath;
  opacity: number;
  children?: React.ReactNode;
}) {
  const { gradient } = shape;
  return (
    <Path
      path={shape.d}
      color={shape.color}
      opacity={opacity}
      style={shape.style}
      strokeWidth={shape.strokeWidth ?? STROKE}
      strokeJoin="round"
      strokeCap="round"
    >
      {gradient ? (
        <LinearGradient
          start={vec(0, gradient.y0)}
          end={vec(0, gradient.y1)}
          colors={[gradient.from, gradient.to]}
        />
      ) : null}
      {shape.dash ? <DashPathEffect intervals={shape.dash} /> : null}
      {children}
    </Path>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    left: -BLEED,
    top: -BLEED,
  },
});

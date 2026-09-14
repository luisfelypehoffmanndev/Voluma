import { Canvas, Fill, Shader, Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ambient, colors } from '@/theme/tokens';

/** O valor de cinza de um hex `#RRGGBB` — o mesmo `grayOf` de `composite.ts`. */
function grayOf(hex: string): number {
  const channel = hex.match(/^#([0-9a-f]{2})/i);
  if (!channel) throw new Error(`Nao e um hex #RRGGBB: ${hex}`);
  return parseInt(channel[1], 16);
}

/**
 * O SkSL e GERADO a partir dos tokens, e nao escrito a mao.
 *
 * A curva de queda e a lista de halos existem em `tokens.ts` e sao travadas por
 * `composite.test.ts`. Transcrever os mesmos numeros para dentro de uma string
 * de shader criaria uma segunda fonte de verdade que nenhum teste alcanca — e o
 * dia em que as duas divergissem, o app mostraria um campo e o teste garantiria
 * outro, sem nada falhar.
 */
function buildSource(): string {
  const bg = grayOf(colors.bg);

  // A queda vira uma escada de `mix` entre os pontos consecutivos do token.
  const segments = ambient.falloff
    .slice(0, -1)
    .map((point, i) => {
      const next = ambient.falloff[i + 1];
      const t = `(d - ${point.offset.toFixed(4)}) / ${(next.offset - point.offset).toFixed(4)}`;
      return `  if (d < ${next.offset.toFixed(4)}) return mix(${point.weight.toFixed(4)}, ${next.weight.toFixed(4)}, ${t});`;
    })
    .join('\n');

  // Cada halo: distancia normalizada ao raio, POR EIXO — a elipse do
  // `objectBoundingBox` que os valores dos tokens assumem. Ver `tokens.ts`.
  const layers = ambient.halos
    .map(
      (halo) => `
  {
    float2 d2 = (xy - float2(${halo.cx.toFixed(4)}, ${halo.cy.toFixed(4)}) * uSize)
              / (${halo.r.toFixed(4)} * uSize);
    v = over(${halo.opacity.toFixed(4)} * falloff(length(d2)), v);
  }`,
    )
    .join('');

  return `
uniform float2 uSize;

/** Branco a \`a\` sobre um fundo de valor \`base\`, em 0-255. O \`over\` de composite.ts. */
float over(float a, float base) { return base + a * (255.0 - base); }

float falloff(float d) {
  if (d >= 1.0) return 0.0;
${segments}
  return 0.0;
}

/**
 * Hash 2D sem seno (Dave Hoskins). Devolve uniforme em [0, 1).
 *
 * Nao e \`interleaved gradient noise\`, que foi a primeira tentativa: a IGN e
 * uma lattice, e lattice desenha uma trama diagonal regular. Com amplitude de
 * 1 nivel isso e sutil, mas trama estruturada o olho pega muito melhor que
 * ruido sem estrutura na mesma amplitude — que e a razao de o brief exigir
 * blue noise no lugar de branco. Sem lattice, essa objecao cai.
 *
 * Blue noise seria melhor ainda, mas exigiria uma textura; a 1 nivel, que e a
 * amplitude de dither de verdade, branco ja e o que a teoria prescreve.
 */
float hash(float2 p) {
  float3 q = fract(float3(p.x, p.y, p.x) * 0.1031);
  q += dot(q, float3(q.y, q.z, q.x) + 33.33);
  return fract((q.x + q.y) * q.z);
}

/** Soma de dois uniformes independentes: TRIANGULAR em [-1, 1], media zero. */
float dither(float2 p) {
  return hash(p) + hash(p + 17.0) - 1.0;
}

half4 main(float2 xy) {
  float v = ${bg}.0;
${layers}

  // A soma acontece AQUI, antes de o framebuffer arredondar para 8 bits. E a
  // linha inteira do arquivo: e o que faz disto dither de verdade em vez de
  // mascara, e o que permite a amplitude voltar ao ~1 nivel que o brief queria.
  v = v + dither(xy) * ${ambient.dither.toFixed(1)};

  // Cast explicito para \`half\`: o SkSL e mais estrito que o GLSL em conversao
  // de precisao, e float -> half dentro de construtor e o tipo de coisa que
  // compila num backend e falha em outro.
  half c = half(v / 255.0);
  return half4(c, c, c, 1.0);
}
`;
}

/**
 * `Make` devolve `null` quando o SkSL nao compila, e o shader e montado a partir
 * dos tokens — ou seja, um valor estranho num token vira erro de compilacao.
 * Sem esta checagem isso chegaria como um crash opaco la na frente; aqui vem
 * com o codigo-fonte junto, que e o unico jeito de achar a linha culpada.
 */
function compile(): SkRuntimeEffect {
  const sksl = buildSource();
  const effect = Skia.RuntimeEffect.Make(sksl);
  if (!effect) {
    throw new Error(`O shader do campo de luz nao compilou. Fonte gerada:\n${sksl}`);
  }
  return effect;
}

const source = compile();

/**
 * O campo de luz atras de tudo.
 *
 * Existe porque o brief pede vidro, e vidro precisa de algo para amostrar: sem
 * campo, uma superficie translucida nao tem gradiente por tras e vira um
 * retangulo cinza. `Design/design.md` e explicito — "vidro sobre fundo liso e
 * mentira", "o fundo nao pode ser chapado".
 *
 * **Por que Skia, e nao SVG.** O `react-native-svg` desenha com CoreGraphics no
 * iOS e `android.graphics` no Android: dois rasterizadores diferentes, e so um
 * deles ditera gradiente por padrao. Foi dai que saiu toda a divergencia entre
 * as plataformas, e nenhuma quantidade de ruido por cima resolvia — o brief ja
 * apontava o `Paint.setDither` do Android como a correcao de origem, e a
 * registrava como inalcancavel dentro do Expo Go.
 *
 * Skia e o MESMO motor nos dois sistemas. O mesmo shader produz os mesmos
 * pixels, entao "igual ao iPhone" deixa de ser algo a perseguir e passa a ser
 * verdade por construcao. O custo e sair do Expo Go, que era exatamente o
 * pedagio que o brief dizia ser preciso pagar.
 *
 * Duas consequencias que apagam bugs inteiros:
 *
 * 1. **O ruido virou dither.** Ele entra dentro do shader, antes do
 *    arredondamento, entao desfaz o degrau em vez de mascarar. Some com ele o
 *    `assets/noise*.png`, o `make-noise.js`, o ladrilho, as variantes por
 *    densidade e o reescalonamento — que foi a origem de todas as quebras: o
 *    `<Pattern>` degradava no 3x, e o `resizeMode="repeat"` chegou a desenhar
 *    o grao num unico retangulo no canto da tela e mais nada.
 *
 * 2. **Nao ha composicao intermediaria em 8 bits.** Os tres halos compoem em
 *    ponto flutuante numa passada so. Antes eram tres `<Rect>` empilhados,
 *    cada um quantizando em cima do anterior.
 *
 * Ele nao rola: fica fora do `ScrollView`, entao os cards deslizam por cima e
 * mudam de luminancia enquanto a lista anda. Essa paralaxe e o que vende o
 * vidro, e o brief a chama de arquitetura, nao efeito.
 */
export function Ambient() {
  const { width, height } = useWindowDimensions();
  const uniforms = useMemo(() => ({ uSize: [width, height] }), [width, height]);

  return (
    <View style={styles.field} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={source} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFill,
    // Placeholder pelos poucos frames ate o Skia montar. E o `bg` exato, que e
    // tambem o valor do campo onde nao ha halo nenhum — o que aparece antes e o
    // proprio fundo do app, nao um salto de luminancia.
    backgroundColor: colors.bg,
  },
});

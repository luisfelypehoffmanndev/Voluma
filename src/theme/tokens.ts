/**
 * Tokens de design — transcritos de Design/design.md.
 *
 * Regra dura do brief: preto e branco fazem 95% do trabalho. `accent` aparece
 * em no maximo UM elemento por tela. Se dois elementos da mesma tela usam
 * accent, um deles esta errado.
 */

import { grayOf } from './composite';

export const colors = {
  /** fundo base, quase preto — nunca #000 puro (mata a profundidade) */
  bg: '#0A0A0A',
  /** bordas de 1px, nunca mais grossas */
  border: 'rgba(255,255,255,0.08)',
  /**
   * Divisores dentro de um card.
   *
   * Mais forte que `border` de proposito: a linha nao vive mais sobre o
   * #161616 chapado de antes, e sim sobre uma superficie que clareia ao
   * atravessar um halo do campo de luz. A 0,08 ela enfraquecia justamente onde
   * o card estava mais claro.
   */
  divider: 'rgba(255,255,255,0.12)',
  /** borda um pouco mais visivel, para marcar estado sem mudar preenchimento */
  borderStrong: 'rgba(255,255,255,0.18)',
  textPrimary: '#F5F5F5',
  textSecondary: '#8A8A8A',
  /**
   * Texto sobre fundo accent solido. Preto puro, e nao o `bg` quase-preto: sobre
   * o laranja, qualquer cinza no lugar do preto vira marrom sujo.
   */
  textOnAccent: '#000000',
  /**
   * Laranja neon — uso minimo, 1 elemento de destaque por tela.
   *
   * Saturacao maxima, matiz entre o queimado original (#FF4E17) e o laranja
   * puro. Puxar mais para o amarelo aumenta o contraste no papel mas le como
   * cone de obra; puxar para o vermelho queima mais e custa legibilidade. Aqui
   * o contraste com o preto e 6,8:1 — melhor que os 6,4:1 do original.
   *
   * O que faz ler como neon nao e so a matiz: e o `accentGlow` em volta.
   */
  accent: '#FF5C00',
  /** pontos apagados do dot-matrix (dias sem treino) */
  dotEmpty: 'rgba(255,255,255,0.14)',
  /** pontos cheios do dot-matrix (dias com treino) */
  dotFilled: '#F5F5F5',
  /**
   * Rampa do dot-matrix: um passo por faixa de carga do dia, do vazio ao mais
   * pesado da janela. Escala de cinza, nunca heatmap colorido — o brief e
   * explicito. Os passos sao discretos de proposito: num gradiente continuo
   * dois dias de carga parecida ficam indistinguiveis e a grade vira ruido.
   */
  dotLevels: [
    'rgba(255,255,255,0.07)',
    'rgba(245,245,245,0.28)',
    'rgba(245,245,245,0.50)',
    'rgba(245,245,245,0.74)',
    '#F5F5F5',
  ],
} as const;

/**
 * A escada de densidade.
 *
 * Nenhuma superficie do app tem cor propria: todas sao branco translucido sobre
 * o campo de luz do `Ambient`. O que separa um nivel do outro e o alpha, nao a
 * materia. Branco a alpha `A` sobre um valor `B` resulta em `B + A·(255−B)` —
 * a conta vive em `src/theme/composite.ts`, com teste, e e ela que fixou os
 * numeros abaixo:
 *
 * | nivel | o que                  | alpha       | sobre o fundo sem halo |
 * |-------|------------------------|-------------|------------------------|
 * | 1     | card, grupo de treino  | 0,06        | `#191919`              |
 * | 2     | superficie dentro dele | 0,08        | `#2B2B2B`              |
 * | 3     | tab bar, modal         | ver `glass` | quase opaco            |
 *
 * Duas consequencias que valem lembrar antes de mexer nos valores:
 *
 * - **O baseline nao muda.** A 6% o card cai em `#191919` onde nao ha halo —
 *   praticamente o `#161616` dos cards solidos de antes. O vidro nao clareia o
 *   app; ele so faz a superficie *amostrar* o que passa por tras.
 * - **A separacao card/fundo nao depende da posicao.** Ela fica entre 12,9 e
 *   14,7 pontos em qualquer ponto do campo, contra os 12 fixos de antes.
 */
export const surfaces = {
  /** nivel 1 — cards e grupos, o que rola junto com a pagina */
  card: 'rgba(255,255,255,0.06)',
  /**
   * Nivel 1 pressionado. O vidro *acende*; opacidade na superficie inteira nao
   * serve aqui, porque apagaria o texto junto e o card quase sumiria.
   */
  cardPressed: 'rgba(255,255,255,0.11)',
  /** nivel 2 — superficie dentro de um card: input, dia selecionado */
  raised: 'rgba(255,255,255,0.08)',
  /**
   * Nivel 1 em area pequena (o botao redondo do cabecalho). Alpha um pouco
   * maior: numa area de 38px o olho le menos luz atravessando, e a 6% o botao
   * sumia do cabecalho.
   */
  control: 'rgba(255,255,255,0.09)',
  controlPressed: 'rgba(255,255,255,0.14)',
  /**
   * Especular do card — os mesmos tres param do `border-image` do brief, um por
   * lado, mas mais contido que o do `glass`: sao 5-6 cards por tela, nao um
   * elemento flutuante solitario.
   */
  specularTop: 'rgba(255,255,255,0.18)',
  specularSide: 'rgba(255,255,255,0.10)',
  specularBottom: 'rgba(255,255,255,0.05)',
} as const;

/**
 * Vidro de nivel 3 — o chrome que flutua e precisa OCULTAR o que passa por
 * baixo: a tab bar e o modal. E o unico nivel quase opaco da escada; os cards,
 * que existem justamente para deixar o campo de luz atravessar, usam
 * `surfaces`.
 *
 * O blur so existe no iOS. No Android o expo-blur crasha com o unico metodo
 * que borra de verdade, entao `GlassSurface` cai para `fillNoBlur` — os tokens
 * de blur abaixo nao sao lidos naquela plataforma.
 */
export const glass = {
  /** preenchimento por cima do blur (iOS) */
  fill: 'rgba(255,255,255,0.10)',
  /**
   * Preenchimento do Android, onde nao ha blur por tras (ver GlassSurface).
   * Precisa ser quase opaco: sem borrar o que passa embaixo, uma superficie
   * translucida deixaria o conteudo rolar legivel atras do vidro.
   *
   * Baixou de 0,93 para 0,86 quando os cards viraram vidro: contra superficies
   * translucidas, o chrome a 0,93 lia como laje. O limite e a legibilidade — se
   * der para ler o texto que passa por baixo, subiu demais.
   */
  fillNoBlur: 'rgba(34,34,37,0.86)',
  border: 'rgba(255,255,255,0.12)',
  /**
   * Brilho especular — os tres param do `border-image` do brief, um por lado.
   * O gradiente vai de `specularTop` na quina de cima ate `specularBottom` na
   * de baixo; as laterais ficam no meio do caminho. Ver `GlassSurface`.
   */
  specularTop: 'rgba(255,255,255,0.28)',
  specularSide: 'rgba(255,255,255,0.16)',
  specularBottom: 'rgba(255,255,255,0.04)',
  blurIntensity: 40,
  blurReductionFactor: 3,
} as const;

/**
 * Brilho do card accent.
 *
 * O que faz uma cor ler como neon num fundo escuro e a luz vazando para fora,
 * nao a matiz — letreiro de neon acende o vidro em volta. Sem isto o card fica
 * so um retangulo laranja chapado.
 *
 * O brief proibe sombra difusa como *separador*; isto nao separa nada, e o
 * brilho do unico elemento accent da tela.
 */
export const accentGlow = {
  opacity: 0.55,
  radius: 18,
  /** Android: sombra por elevacao, tingida pelo shadowColor so a partir do 9. */
  elevation: 12,
} as const;

/**
 * O campo de luz atras de tudo — o que as superficies de vidro amostram.
 *
 * Tres halos brancos cobrindo a tela inteira, e nao um brilho preso no topo:
 * sem luz la embaixo, um card no fim da rolagem seria vidro sobre preto
 * chapado, que o brief chama pelo nome de mentira.
 *
 * As posicoes sao assimetricas de proposito. Halos simetricos leem como
 * vinheta; assimetricos leem como luz entrando num ambiente — e a diferenca
 * entre "campo de luz" e "efeito".
 */
export const ambient = {
  color: '#FFFFFF',
  halos: [
    { id: 'topo', cx: '50%', cy: '0%', r: '85%', opacity: 0.09 },
    { id: 'direita', cx: '88%', cy: '42%', r: '55%', opacity: 0.06 },
    { id: 'base', cx: '10%', cy: '88%', r: '60%', opacity: 0.05 },
  ],
  /**
   * Como cada halo cai, em fracao da opacidade de pico.
   *
   * Substitui a rampa linear de dois stops que havia antes. O ganho nao e
   * "suavidade" no sentido vago: a rampa linear **para de mudar de golpe** em
   * `offset = 1`, e essa quina na derivada e lida pelo olho como um anel nitido
   * na borda do halo — independente de quantizacao, e pior justamente onde o
   * halo deveria estar sumindo.
   *
   * A curva abaixo aproxima uma gaussiana e chega em zero pela tangente, sem
   * quina. O peso 1 no offset 0 mantem o pico intocado: `composite.test.ts`
   * exige que o campo chegue a #202020 e nao passe disso.
   */
  falloff: [
    { offset: 0, weight: 1 },
    { offset: 0.25, weight: 0.78 },
    { offset: 0.5, weight: 0.45 },
    { offset: 0.7, weight: 0.22 },
    { offset: 0.85, weight: 0.09 },
    { offset: 1, weight: 0 },
  ],
} as const;

/**
 * O mesmo campo de luz, na forma que o React Native desenha nativamente.
 *
 * Nao e uma segunda fonte de verdade: os halos e a queda continuam sendo os de
 * `ambient` acima, e este export so os traduz. Trocar um numero la muda os dois
 * caminhos, que e o unico jeito de isto nao apodrecer.
 *
 * Por que existe: desenhado por `react-native-svg`, o campo passa por um bitmap
 * de *software* (`SvgView.java` faz `new Canvas(bitmap)`, que nunca e HWUI) e a
 * lib nao liga `setDither` em lugar nenhum da arvore Android. Sao tres `Rect`
 * empilhados, entao a mesma rampa e quantizada em 8 bits tres vezes, na CPU,
 * sem dither — e e dai que vem o banding.
 *
 * Como camada de fundo nativa, `BackgroundDrawable` funde as tres num unico
 * `ComposeShader` e desenha de uma vez so no canvas acelerado da View: uma
 * quantizacao, na GPU, no pipeline que dithera gradiente.
 *
 * Duas armadilhas, ambas silenciosas:
 *
 * 1. `RadialGradient.parse` devolve `null` — descartando o gradiente sem erro
 *    nenhum — se `position` nao tiver (`top` ou `bottom`) E (`left` ou
 *    `right`). Os dois vao sempre juntos aqui.
 * 2. A ordem da lista e a ordem de composicao (`SRC_OVER`), igual ao empilhado
 *    dos `Rect` que havia antes. Nao reordene sem olhar o resultado.
 *
 * O tipo publico de `experimental_backgroundImage` no RN 0.81 ainda so descreve
 * `linear-gradient`, embora o runtime e o lado nativo aceitem radial — por isso
 * o formato vive aqui, tipado de verdade, e o cast fica num lugar so, em
 * `Ambient.tsx`.
 */
/**
 * O campo e branco puro, e o app inteiro e neutro — a mesma premissa que
 * `composite.ts` assume ao trabalhar com um canal so.
 */
const AMBIENT_CHANNEL = grayOf(ambient.color);

export type RadialGradientLayer = {
  type: 'radial-gradient';
  shape: 'ellipse';
  size: { x: string; y: string };
  position: { top: string; left: string };
  colorStops: { color: string; position: string }[];
};

/**
 * A forma linear do mesmo mecanismo, para quem precisa pintar um trecho do
 * campo em vez de deixa-lo passar (ver `field.ts` e a tab bar).
 *
 * `positions` e plural e e um array de propositio: e assim que
 * `processBackgroundImage` le os stops. O `.d.ts` do RN 0.81 declara
 * `ReadonlyArray<string[]>` — um nivel de array a mais do que o runtime aceita —
 * entao aqui, como no radial, o tipo de verdade mora neste arquivo e o cast
 * fica num lugar so, no site de uso.
 */
export type LinearGradientLayer = {
  type: 'linear-gradient';
  direction: string;
  colorStops: { color: string; positions: string[] }[];
};

export const ambientBackground: RadialGradientLayer[] = ambient.halos.map((halo) => ({
  type: 'radial-gradient',
  shape: 'ellipse',
  // `r` sai de unidades de bounding box do SVG, onde 85% ja quer dizer
  // 0,85*largura por 0,85*altura — que e exatamente o par (x, y) daqui.
  size: { x: halo.r, y: halo.r },
  position: { top: halo.cy, left: halo.cx },
  colorStops: ambient.falloff.map((point) => ({
    color: `rgba(${AMBIENT_CHANNEL}, ${AMBIENT_CHANNEL}, ${AMBIENT_CHANNEL}, ${
      halo.opacity * point.weight
    })`,
    position: `${point.offset * 100}%`,
  })),
}));

/** Raio consistente por nivel de hierarquia — nunca raios aleatorios entre irmaos. */
export const radius = {
  /** cards de nivel 1 (bento grid, cards de tela) */
  card: 24,
  /** elementos internos de um card (linhas de serie, chips) */
  inner: 14,
  /**
   * Quadrados pequenos: o dia do calendario. Cerca de um quarto do lado, que e
   * a mesma proporcao das celulas do dot-matrix (4px de lado, 1px de quina).
   * `inner` aqui nao serve: 14 sobre 34px chega a 82% do caminho ate o circulo
   * e o quadrado vira pilula.
   */
  square: 10,
  /** pill / botao redondo */
  pill: 999,
} as const;

/** Escala de espacamento em multiplos de 4. Respiro > densidade. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/**
 * Duas familias, papeis bem definidos:
 * - mono geometrica de traco fino para numeros e displays ("ar de instrumento")
 * - sans neutra e discreta para UI, labels e corpo. Nunca italico.
 */
export const fonts = {
  monoLight: 'JetBrainsMono_300Light',
  mono: 'JetBrainsMono_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
} as const;

/** label 12–13, corpo 15–16, numero de destaque 48–72. */
export const fontSize = {
  label: 12,
  labelLg: 13,
  body: 15,
  bodyLg: 16,
  title: 22,
  /** numero secundario (o "43" ao lado da hora) */
  numberSm: 20,
  numberMd: 34,
  /** numero protagonista da tela */
  numberLg: 56,
  numberXl: 72,
} as const;

export const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 } as const;

export type Colors = typeof colors;

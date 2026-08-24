/**
 * Tokens de design — transcritos de Design/design.md.
 *
 * Regra dura do brief: preto e branco fazem 95% do trabalho. `accent` aparece
 * em no maximo UM elemento por tela. Se dois elementos da mesma tela usam
 * accent, um deles esta errado.
 */

export const colors = {
  /** fundo base, quase preto — nunca #000 puro (mata a profundidade) */
  bg: '#0A0A0A',
  /** cards e superficies elevadas */
  surface: '#161616',
  /** superficie um passo acima, para linhas de serie dentro de um card */
  surfaceRaised: '#1E1E1E',
  /** bordas de 1px, nunca mais grossas */
  border: 'rgba(255,255,255,0.08)',
  /** borda um pouco mais visivel, para o highlight superior do glass */
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
 * Vidro — camada estrutural, nao enfeite. O que flutua e vidro; o que e
 * conteudo e solido.
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
   */
  fillNoBlur: 'rgba(34,34,37,0.93)',
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

/** Brilho ambiente atras do conteudo rolavel — sem ele o blur nao tem o que borrar. */
export const ambient = {
  color: '#FFFFFF',
  opacity: 0.04,
  /** altura do brilho a partir do topo da area rolavel, em px */
  height: 320,
} as const;

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

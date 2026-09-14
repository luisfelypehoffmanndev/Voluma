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
 * Os tokens vem em pares porque a superficie tem dois corpos possiveis. Com
 * blur atras (iOS sempre, Android 12+ com um alvo em maos) valem `fill` e os
 * `specular*`; sem ele valem `fillNoBlur` e os `specular*NoBlur`. Nao e
 * escolha de estilo: uma aresta calibrada contra material borrado vira
 * contorno branco sobre a laje fosca, e um preenchimento de 10% de branco sem
 * nada borrado atras nao esconde coisa nenhuma. Ver `GlassSurface`.
 */
export const glass = {
  /** preenchimento por cima do blur */
  fill: 'rgba(255,255,255,0.10)',
  /**
   * Preenchimento de quando nao ha blur por tras (ver GlassSurface): Android
   * 11 e abaixo, e qualquer vidro sem alvo — o painel dentro de um `Modal`.
   * Precisa ser quase opaco: sem borrar o que passa embaixo, uma superficie
   * translucida deixaria o conteudo rolar legivel atras do vidro.
   *
   * E a UNICA superficie do app com cor propria — todas as outras sao branco
   * translucido sobre o campo de luz. Por isso ela e a unica que pode errar de
   * *tom* em vez de so errar de alpha, e foi o que aconteceu duas vezes:
   *
   * - `rgba(...,0.93)` lia como laje quando os cards viraram vidro. Baixou para
   *   0,86.
   * - `rgba(34,34,37,0.86)` continuava lendo como laje, e a conta mostra por
   *   que: compunha em `#1F1F1F` sobre o fundo e `#222222` sobre o halo. O pico
   *   do campo de luz inteiro e `#202020` (travado em composite.test.ts). Ou
   *   seja, a barra era tao clara quanto o ponto mais forte de toda a tela, em
   *   qualquer posicao — um retangulo cinza colado sobre um fundo quase preto.
   *   O 37 no azul ainda dava um viés frio que nenhuma outra superficie tem.
   *
   * Agora: cinza neutro da familia do `bg`, compondo em `#181818` sobre o fundo
   * e `#1B1B1B` sobre o halo — ou seja, NO NIVEL do card (`#191919`).
   *
   * Nivelar com o card e o alvo, nao um acaso. O chrome de nivel 3 nao se
   * distingue por brilhar mais que o conteudo — quem o separa do fundo e a
   * aresta especular, e o que o faz ser nivel 3 e ocultar o que passa por
   * baixo. Passar do card foi exatamente o erro anterior; ficar muito abaixo
   * dele (a primeira tentativa deste conserto, em `#111111`) leu como escura
   * demais contra o resto do app. O teto duro continua sendo o pico do campo de
   * luz, `#202020`.
   *
   * O alpha subiu junto (0,86 -> 0,90): o fantasma do texto que rola por baixo
   * caiu de 33 para 23 niveis de cinza. O limite continua sendo a legibilidade
   * — se der para ler o que passa embaixo, subiu demais.
   *
   * Vale dizer que 0,90 nunca zerou esse fantasma; foi o melhor acordo
   * possivel enquanto o Android inteiro dependia deste caminho. Hoje o
   * aparelho moderno borra de verdade e nao passa por aqui.
   */
  fillNoBlur: 'rgba(26,26,26,0.90)',
  border: 'rgba(255,255,255,0.12)',
  /**
   * Brilho especular — os tres param do `border-image` do brief, um por lado.
   * O gradiente vai de `specularTop` na quina de cima ate `specularBottom` na
   * de baixo; as laterais ficam no meio do caminho. Ver `GlassSurface`.
   */
  specularTop: 'rgba(255,255,255,0.28)',
  specularSide: 'rgba(255,255,255,0.16)',
  specularBottom: 'rgba(255,255,255,0.04)',
  /**
   * O mesmo especular onde nao ha blur — mesma assimetria que separa `fill` de
   * `fillNoBlur`, e pela mesma razao de fundo.
   *
   * O `0,28` do brief pressupoe o material borrado atras: no iOS o backdrop
   * levanta o corpo do vidro para ~`#3E3E3E`, e a aresta fica 1,3x acima dele —
   * luz raspando a quina. No Android o corpo e uma laje quase opaca em
   * `#191919`, e a MESMA aresta fica 3,3x acima: deixa de ler como luz e vira
   * uma linha branca desenhada em volta do pill.
   *
   * A razao alvo aqui e ~2x, que mantem a aresta definindo a forma (sem blur,
   * e so ela que separa o chrome do fundo) sem ela virar contorno. As tres
   * param caem na mesma proporcao para preservar a direcao da luz, que o brief
   * chama de obrigatoria: forte na quina de cima, sumindo ao descer.
   */
  specularTopNoBlur: 'rgba(255,255,255,0.16)',
  specularSideNoBlur: 'rgba(255,255,255,0.09)',
  specularBottomNoBlur: 'rgba(255,255,255,0.03)',
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
 * Do brief (`Design/design.md`): tres halos brancos radiais a 0,09 / 0,06 /
 * 0,05, **cobrindo a tela inteira**. Nao e enfeite — la esta escrito que "vidro
 * sobre fundo liso e mentira" e que "o fundo nao pode ser chapado". Sem campo,
 * uma superficie translucida nao tem o que amostrar e vira retangulo cinza.
 *
 * Eles sao **fixos**: os cards deslizam por cima e mudam de tom conforme rolam,
 * e e essa paralaxe que vende o vidro. E sao **assimetricos**: halo simetrico
 * le como vinheta, assimetrico le como luz entrando num ambiente.
 *
 * Fracoes, e nao porcentagens em string, porque quem consome isto agora e um
 * shader — ver `Ambient.tsx`. `cx`/`cy` sao fracao da tela; `r` e fracao da
 * caixa EM CADA EIXO, ou seja o halo e uma elipse esticada pela proporcao da
 * tela. Isso nao e descuido: e exatamente o que o `objectBoundingBox` do SVG
 * fazia, e e contra esse desenho que os valores 0,85 / 0,55 / 0,6 foram
 * afinados. Trocar por circulo verdadeiro mudaria a composicao inteira.
 */
export const ambient = {
  color: '#FFFFFF',
  halos: [
    { id: 'topo', cx: 0.5, cy: 0.0, r: 0.85, opacity: 0.09 },
    { id: 'direita', cx: 0.88, cy: 0.42, r: 0.55, opacity: 0.06 },
    { id: 'base', cx: 0.1, cy: 0.88, r: 0.6, opacity: 0.05 },
  ],
  /**
   * Como cada halo cai, do centro (`offset` 0) ate a borda do raio (1).
   *
   * Seis pontos aproximando uma gaussiana, e nao dois. Rampa linear **para de
   * mudar de golpe** no fim do raio, e essa quina na derivada e lida pelo olho
   * como um anel nitido na borda do halo — independente de quantizacao, e pior
   * justamente onde o halo deveria estar sumindo.
   *
   * O peso 1 no offset 0 mantem o pico intocado: `composite.test.ts` exige que
   * o campo chegue a #202020 e nao passe disso.
   */
  falloff: [
    { offset: 0, weight: 1 },
    { offset: 0.25, weight: 0.78 },
    { offset: 0.5, weight: 0.45 },
    { offset: 0.7, weight: 0.22 },
    { offset: 0.85, weight: 0.09 },
    { offset: 1, weight: 0 },
  ],
  /**
   * Amplitude do dither, em niveis de cinza (meia-largura de um TPDF simetrico).
   *
   * O brief pedia ~1 nivel e registrou ter subido para ~2 a contragosto: o
   * ruido entrava DEPOIS do `react-native-svg` ja ter quantizado o gradiente,
   * entao mascarava a borda em vez de desfazer o degrau, e mascarar custa mais
   * amplitude. Com o campo num shader o ruido entra antes do arredondamento —
   * e dither de verdade, e 1 basta.
   */
  dither: 1,
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

/**
 * Icone de aba: o estado vem de aceso/apagado, nao de duas cores.
 *
 * O §7 do brief ja define estado assim — "aceso/apagado na mesma matiz" — e
 * aqui isso tambem evita um custo tecnico real: animar a COR exigiria tornar
 * cada `Path`/`Line`/`Rect` dos quatro icones um componente animado do
 * `react-native-svg`. Opacidade num wrapper e uma view so.
 *
 * O valor nao foi escolhido a olho: e a opacidade que poe o icone branco
 * exatamente no `#8A8A8A` que o inativo tinha quando era cor. A conta esta
 * travada em composite.test.ts.
 *
 * Ela mira o Android, onde o corpo da barra e a laje `#191919` do `fillNoBlur`.
 * No iOS o backdrop borrado levanta o corpo e o inativo pousa alguns niveis
 * mais claro — diferenca pequena demais para justificar ramificar por
 * plataforma um unico numero.
 */
export const tabIcon = { idleOpacity: 0.515 } as const;

/**
 * Movimento — transcrito de Design/design.md §10.
 *
 * Ponteiro de instrumento e criticamente amortecido: vai ate a leitura e para.
 * Toda animacao do app e ou um VALOR se acomodando (cor, opacidade) ou um
 * elemento entrando/saindo do layout. Nunca forma, nunca tamanho, nunca mola.
 *
 * Sao seis numeros e uma curva. "Contagem baixa" quer dizer poucos numeros, nao
 * numeros pequenos — o sexto (`count`) existe porque marcar uma serie concluida
 * faz o volume levantado atravessar varios valores intermediarios legiveis a
 * caminho do numero final, e nenhum dos outros cinco dura o bastante pra isso
 * ler como contagem em vez de tremulacao. Ainda e so "um valor se acomodando";
 * a diferenca e que este se acomoda em texto, nao em estilo, e o caminho tem
 * que dar tempo pro olho seguir os digitos passando.
 *
 * A curva fica aqui como tupla, e nao como `Easing.bezier`, porque este arquivo
 * NAO importa nada — e o que deixa `composite.test.ts` roda-lo em Node puro. A
 * conversao vive em `src/ui/motion.ts`.
 */
export const motion = {
  duration: {
    /**
     * Dedo desce: **instantaneo**, igual ao snap de antes de existir animacao.
     *
     * Nao e falta de capricho, e a correcao de um erro real. A primeira versao
     * subia em 90ms, e um toque rapido dura menos que isso: o `withTiming` era
     * interrompido no meio, o card acendia pela metade e voltava. O retorno
     * ficava tao fraco que lia como "nao acertei o botao" — chegou a ser
     * reportado como hitbox menor, que nunca foi.
     *
     * A regra que sai disso: confirmacao de toque nunca tem rampa. O dedo ja
     * esta la; qualquer duracao aqui e latencia pura, e a unica coisa que ela
     * pode fazer e chegar atrasada.
     */
    pressIn: 0,
    /**
     * Dedo sobe: relaxa. Aqui a rampa nao custa nada — nao ha nada esperando
     * por ela — e e ela que separa "estado que pisca" de "superficie que
     * acende". E o unico movimento do gesto de toque.
     */
    pressOut: 110,
    /**
     * Um estado se acomodando: preenchimento, borda, tint. Curto o bastante
     * para nao atrasar o toque seguinte, longo o bastante para ser lido como
     * transicao em vez de troca de frame.
     */
    state: 160,
    /** Elemento entrando na lista — mais longo que `state` porque percorre
     *  distancia alem de opacidade. */
    enter: 200,
    /**
     * Elemento saindo. Sempre mais curto que `enter`: ninguem espera uma
     * despedida, e o buraco na lista precisa fechar antes do proximo toque.
     */
    exit: 120,
    /**
     * Um numero subindo (ou descendo) ate o valor final — o volume levantado
     * depois de marcar uma serie. Bem mais longo que `state` porque aqui a
     * leitura nao e binaria (apagado/aceso, presente/ausente): o olho
     * acompanha varios valores passando, nao so nota que algo mudou. Curto
     * demais, na faixa de `state`/`enter`, e os digitos borram e a contagem
     * le como troca de frame; longo demais e a tela parece atrasada depois de
     * um toque que ja foi confirmado (o `CheckCell` acende em `state`, bem
     * antes disso terminar).
     */
    count: 700,
  },
  /** Desacelera ate parar, derivada final zero. Um ease-out cubico. */
  easing: [0.22, 0.61, 0.36, 1],
} as const;

export type Colors = typeof colors;

# Design System — App de Academia (uso pessoal)

> Este documento é um brief de design para guiar qualquer ferramenta (Claude, Cursor, Figma, etc.) na construção da interface. O objetivo é fugir do "cara de app gerado por IA": nada de gradientes decorativos, glow roxo/azul, ícones fofos genéricos ou cards com sombra pesada em tudo. A referência é dashboard técnico + widget de iOS: frio, preciso, quase de instrumento de medição.

## 1. Princípio central

Preto e branco fazem 95% do trabalho. Cor só aparece para **uma coisa que precisa de atenção imediata** (um recorde, uma meta batida, um alerta). Se dois elementos da mesma tela usam cor, um deles está errado.

Pense em painel de instrumento (velocímetro, equalizador, terminal), não em "app de bem-estar fofinho".

## 2. Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0A0A0A` | fundo base, quase preto (nunca `#000` puro — mata a profundidade) |
| `--surface-1` | `rgba(255,255,255,0.06)` | cards e grupos — nível 1 da escada de densidade (§5) |
| `--surface-2` | `rgba(255,255,255,0.08)` | superfície dentro de um card: input, dia selecionado |
| `--glass-fill` | `rgba(255,255,255,0.10)` | preenchimento do vidro de nível 3, por cima do blur |
| `--glass-border` | `rgba(255,255,255,0.12)` | contorno do vidro |
| `--glass-specular` | gradiente branco `0.28 → 0.04` | brilho na borda superior do vidro — luz raspando a quina |
| `--card-specular` | gradiente branco `0.18 → 0.05` | o mesmo brilho, mais contido: são 5–6 cards por tela, não um elemento solitário |
| `--ambient` | 3 halos brancos radiais a `0.09` / `0.06` / `0.05` | o campo de luz atrás de tudo, que as superfícies amostram |
| `--grain` | ruído branco de ~1 nível, ladrilhado | dither do campo de luz — sem ele o gradiente vira anéis |
| `--border` | `rgba(255,255,255,0.08)` | bordas de 1px, nunca mais grossas |
| `--divider` | `rgba(255,255,255,0.12)` | divisores dentro de um card |
| `--text-primary` | `#F5F5F5` | texto principal |
| `--text-secondary` | `#8A8A8A` | labels, metadados, timestamps |
| `--accent` | `#FF5C00` (laranja neon; era `#FF4E17` queimado, trocado por ler terroso no app) + glow no card accent | **uso mínimo**: 1 elemento de destaque por tela, no máximo |

Regra dura: se você usar `--accent` em mais de um elemento na mesma tela, volte e remova um.

Nada de segunda cor de acento (sem verde de "sucesso", sem vermelho de "erro" decorativo). Estado negativo pode ser comunicado com texto/ícone em branco, não com cor.

## 3. Tipografia

Duas famílias, papéis bem definidos — não uma pilha de 4 fontes "pra variar":

- **Display / números grandes (hora, peso, séries):** uma mono geométrica com traço fino — `Space Mono`, `JetBrains Mono` ou similar. É o que dá o ar "instrumento", como o relógio "08:26" das refs. Números grandes ficam com contorno fino (font-weight 300–400), não bold gordo.
- **UI / labels / corpo:** uma sans neutra e discreta — `Inter` ou `SF Pro`. Peso 400–500. Nunca itálico.

Escala sugerida: label 12–13px (secondary), corpo 15–16px, número de destaque 48–72px. Números secundários (o "43" ao lado da hora) ficam menores e alinhados pela base, não pelo centro.

## 4. Layout

- Cards com `border-radius` grande e consistente (20–28px), mas **não em tudo indiscriminadamente** — o raio deve ser o mesmo em toda a hierarquia de um mesmo nível (todos os cards de nível 1 com o mesmo raio).
- Grid tipo bento: blocos de tamanhos diferentes conforme a importância do dado (ex: peso corporal grande, calendário de streak menor), como no print do app de treino.
- Espaçamento generoso. Respiro > densidade. Se parece PDF de planilha, tem elemento demais na tela.
- Divisores são linhas de 1px em `--divider`, nunca sombra difusa simulando linha.
- Ícones: outline, peso fino, monocromáticos (branco ou secondary), nunca preenchidos coloridos. Wi-fi/bluetooth como nas refs — puramente funcionais, sem badge, sem cor.

## 5. O vidro (glass)

O vidro não é enfeite ocasional: é **camada estrutural**. E não é privilégio do que flutua — nenhuma superfície do app tem cor própria. A regra é uma só e resolve todo caso duvidoso:

> **Toda superfície é vidro sobre um campo de luz. O que muda de um nível para o outro é a densidade, não a matéria.**

A escada tem três degraus:

| nível | o quê | alpha | papel |
|---|---|---|---|
| 1 | cards, grupos de exercício, botão redondo do cabeçalho | `0,06` (`0,09` em área pequena) | deixa o campo de luz atravessar |
| 2 | superfície dentro de um card: input, dia selecionado | `0,08` | um degrau acima do card em que está |
| 3 | tab bar, modal, botão fixo sobre a lista | quase opaco | **esconde** o que passa por baixo |

O nível 3 é o único que existe para ocultar — e por isso é o único quase opaco, e por isso ele não serve de card. Usar a receita do nível 3 num card entrega um retângulo praticamente sólido, que é o oposto do que o card existe para fazer.

```css
/* nível 1 — o card */
background: rgba(255, 255, 255, 0.06);
border: 1px solid rgba(255, 255, 255, 0.12);
/* brilho especular: gradiente na borda superior, não linha chapada */
border-image: linear-gradient(rgba(255,255,255,0.18), rgba(255,255,255,0.05)) 1;
```

**Vidro sobre fundo liso é mentira.** Se nada passa por trás, o efeito não existe e você acabou de fazer um retângulo cinza caro. Duas consequências práticas:

- O conteúdo rolável precisa passar *por baixo* das superfícies de nível 3, não parar antes delas.
- O fundo não pode ser chapado. Por isso existe o **campo de luz**: três halos brancos radiais cobrindo a tela inteira. Eles são **fixos** — os cards deslizam por cima deles e mudam de tom conforme rolam, e é essa paralaxe que vende o vidro. E são **assimétricos**: halo simétrico lê como vinheta, assimétrico lê como luz entrando num ambiente.

**A conta que fixa os alphas.** Branco com alpha `A` sobre um valor `B` resulta em `B + A·(255−B)`. É o que garante que o vidro não clareia o app: a 6% sobre o fundo sem halo, o card cai em `#191919` — praticamente o `#161616` dos cards sólidos que vieram antes. O vidro não reescreve o baseline; ele só faz a superfície *amostrar* o que passa por trás. A conta vive em `src/theme/composite.ts`, com teste, justamente para que ninguém mexa num alpha sem ver onde ele foi parar.

**O grão não é textura decorativa.** Um campo que anda 22 níveis de cinza ao longo da tela inteira gasta dezenas de pixels por degrau, e cada degrau aparece como um anel: é *banding*, quantização de 8 bits, e nenhuma dose de suavidade ou de stops a mais resolve. Por cima do campo vai um ruído branco de ~1 nível (`assets/noise@3x.png`, gerado por `scripts/make-noise.js`), que dissolve a fronteira entre um degrau e o seguinte. Ele fica **acima** dos halos de propósito: como as superfícies do app são translúcidas, o grão atravessa para dentro dos cards e dithera também o gradiente que corre por baixo deles.

O **brilho especular** na borda superior é o que separa "vidro Apple" de "retângulo translúcido". Ele é gradiente, não linha de cor sólida — a luz é mais forte na quina e some descendo. É o que dá **direção** à luz, e é obrigatório em todo nível.

### Android

Neste app o blur é privilégio do iOS. O `experimentalBlurMethod="dimezisBlurView"` do `expo-blur` é a única forma de blur real no Android e ele **quebra**: no Android 12+ o `RenderEffectBlur` produz um bitmap de *hardware*, enquanto a lib compõe o frame num Canvas de *software*, e o framework lança `Software rendering doesn't support hardware bitmaps`.

Então o `backdrop-filter` **não é o mecanismo aqui**. O efeito vem de translucidez + campo de luz + aresta especular, e é por isso que ele existe igual nos dois sistemas. Nos cards não há blur em plataforma nenhuma, de propósito: o que passa atrás deles é um degradê suave, e borrar um degradê suave devolve o mesmo degradê suave — no iOS seria invisível e ainda custaria GPU por card em lista rolável.

## 6. Visualização de dados (o elemento assinatura)

Este é o ponto onde o app deve ser reconhecível. Baseado nas refs:

- **Barras de progresso finas e pontilhadas** (tracinhos, não barra sólida cheia) para mostrar decorrer de tempo/fase — como o gráfico de sono.
- **Grade de pontos (dot-matrix)** para histórico/streak de treino ao longo do mês — pontos pequenos, apagados quando não há treino, cheios/brancos quando há. Não usar heatmap colorido tipo GitHub; manter em escala de cinza + 1 ponto em destaque se for recorde.
- Números sempre como protagonistas visuais (peso, volume levantado, horas de sono) — a cor de fundo do card pode inverter (fundo laranja sólido, texto preto) *apenas* no card que representa o dado mais importante da tela, como no card de sono. Isso é o "uso mínimo mas com contraste" que você pediu: em vez de accent como detalhe pequeno, ocasionalmente ele vira o fundo de UM card inteiro para chamar atenção. Esse é o único card que continua **sólido**: laranja translúcido perde o soco.

## 7. O que evitar (sinais de "AI slop")

- Gradientes **coloridos** decorativos (roxo→rosa, azul→ciano) em qualquer botão ou fundo. Gradiente monocromático é permitido em exatamente dois lugares: a borda especular e o campo de luz (`--ambient`). Em nenhum outro.
- Glow/blur colorido atrás de ícones ou cards.
- **Vidro sem campo de luz por trás** — translucidez sobre fundo chapado é o "app slop" translúcido genérico. O erro nunca foi o vidro estar em superfície que não flutua; é não ter nada para atravessar.
- Vidro **colorido** (roxo, ciano). Aqui é branco puro, do campo à borda — é o que mais separa este material do slop.
- Grão ou ruído como "textura" decorativa, à procura de vibe analógica. O único ruído permitido é o dither do campo de luz, a ~1 nível — ele existe para corrigir banding, e se aparecer como textura subiu demais.
- Emojis como substituto de ícone.
- Sombra pesada (`box-shadow` grande e difusa) em todo card — usar no máximo uma sombra sutil e só quando o card realmente flutua.
- Mais de uma cor de destaque na mesma tela.
- Cantos arredondados com raios diferentes e aleatórios entre elementos do mesmo nível.
- Textos genéricos tipo "Bem-vindo de volta!", "Vamos treinar hoje?" — usar dado real e direto (número, hora, "Fridays", "31 min ago").
- Ícones 3D estilo "Fluent/emoji 3D".

## 8. Copy / microtexto

Direto, técnico, sem "vozinha animadora de app de fitness". Ex: `"Volume lifted"`, `"Body weight"`, `"Last 7 days"` — substantivo + dado, sem frase motivacional. Timestamps relativos e objetivos (`31 min ago`, `Yesterday · 14 Aug`).

## 9. Checklist antes de finalizar uma tela

- [ ] Só uma cor de destaque apareceu nesta tela?
- [ ] O fundo é quase-preto (não preto puro, não cinza-azulado)?
- [ ] Os números grandes estão em mono, não em sans bold?
- [ ] Não tem gradiente colorido nem glow em lugar nenhum?
- [ ] Todo elemento de vidro tem campo de luz ou conteúdo real passando por trás?
- [ ] O que flutua está no nível 3 (esconde o que passa por baixo) e o que rola junto com a página, no nível 1?
- [ ] Ao rolar, os cards mudam de tom ao atravessar os halos? (Se não mudam, o campo está fraco demais e o vidro virou retângulo cinza.)
- [ ] O raio dos cantos é consistente entre elementos do mesmo nível?
- [ ] O copy é direto e usa dado real, sem frase de "app motivacional"?

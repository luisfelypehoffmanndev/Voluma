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
| `--grain` | *blue noise* triangular de ~2 níveis, ladrilhado | máscara do banding do campo de luz |
| `--border` | `rgba(255,255,255,0.08)` | bordas de 1px, nunca mais grossas |
| `--divider` | `rgba(255,255,255,0.12)` | divisores dentro de um card |
| `--text-primary` | `#F5F5F5` | texto principal |
| `--text-secondary` | `#8A8A8A` | labels, metadados, timestamps |
| `--accent` | `#FF5C00` (laranja neon; era `#FF4E17` queimado, trocado por ler terroso no app) + glow no card accent | **uso mínimo**: 1 elemento de destaque por tela, no máximo |

Regra dura: se você usar `--accent` em mais de um elemento na mesma tela, volte e remova um.

Nada de segunda cor de acento (sem verde de "sucesso", sem vermelho de "erro" decorativo). Estado negativo pode ser comunicado com texto/ícone em branco, não com cor.

### A única exceção: a caixa de concluído

Há um caso, e só um, em que `--accent` aparece repetido na mesma tela: a **caixa de concluído** do registro de treino (`app/session/[id].tsx`), uma por exercício.

A exceção se sustenta porque a cor ali não está fazendo o trabalho que a regra proíbe. A regra existe para impedir que dois elementos *disputem* a atenção — dois destaques concorrentes diluem os dois. A caixa não destaca um exercício entre os outros: ela marca **um estado binário que se repete**, e o que o laranja comunica é a leitura agregada — quanto do treino já foi feito, visível de relance pela quantidade de caixas acesas. Uma única caixa laranja no meio de caixas apagadas seria a leitura errada.

O limite continua valendo do lado de fora: numa tela que tem caixas de concluído, **nenhum outro elemento** pode usar accent. Foi por isso que o botão fixo de "registrar treino" saiu da tela quando as caixas entraram — os dois juntos seriam exatamente a disputa que a regra impede.

Isso **não** abre precedente para cor de estado (§2, parágrafo acima): não existe caixa verde de "ok" nem vermelha de "falhou". O par é aceso/apagado na mesma matiz, e "não concluído" continua sendo ausência de cor, não outra cor.

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

**O grão não é textura decorativa.** Um campo que anda 22 níveis de cinza ao longo da tela inteira gasta dezenas de pixels por degrau, e cada degrau aparece como um anel: é *banding*, quantização de 8 bits, e nenhuma dose de suavidade ou de stops a mais resolve. Por cima do campo vai um ruído (`assets/noise*.png`, gerado por `scripts/make-noise.js`) que dissolve a fronteira entre um degrau e o seguinte. **Ele não é dither, é máscara** — e a diferença define quanta amplitude ele precisa: dither soma antes do arredondamento, mas aqui o `react-native-svg` já quantizou o gradiente e o grão entra depois, então a estrutura de bandas já está gravada e o ruído só a disfarça. Disfarçar custa mais que ditherar, e é por isso que a amplitude subiu de ~1 para ~2 níveis contra a primeira intenção deste brief. Ligar o `Paint.setDither` do Android, que resolveria na origem, exigiria sair do Expo Go: o `react-native-svg` nativo vem embutido nele. Três detalhes desse ruído não são preciosismo, e a primeira versão errou os três: ele é **blue noise**, não branco — branco tem energia nas baixas frequências, onde o olho enxerga melhor, e lê como mancha em vez de dissolver a borda; a amplitude é **triangular**, não uniforme, que é a distribuição que o dither pede; e existe **uma variante por densidade de tela**, todas com a mesma pegada em dp, porque um único arquivo `@3x` obriga o Metro a reescalar em qualquer aparelho que não seja 3x, e a interpolação bilinear dilui justamente a variância que faz o dither funcionar. Ele fica **acima** dos halos de propósito: como as superfícies do app são translúcidas, o grão atravessa para dentro dos cards e dithera também o gradiente que corre por baixo deles.

O **brilho especular** na borda superior é o que separa "vidro Apple" de "retângulo translúcido". Ele é gradiente, não linha de cor sólida — a luz é mais forte na quina e some descendo. É o que dá **direção** à luz, e é obrigatório em todo nível.

### Android

Neste app o blur é privilégio do iOS. O `experimentalBlurMethod="dimezisBlurView"` do `expo-blur` é a única forma de blur real no Android e ele **quebra**: no Android 12+ o `RenderEffectBlur` produz um bitmap de *hardware*, enquanto a lib compõe o frame num Canvas de *software*, e o framework lança `Software rendering doesn't support hardware bitmaps`.

Então o `backdrop-filter` **não é o mecanismo aqui**. O efeito vem de translucidez + campo de luz + aresta especular, e é por isso que ele existe igual nos dois sistemas. Nos cards não há blur em plataforma nenhuma, de propósito: o que passa atrás deles é um degradê suave, e borrar um degradê suave devolve o mesmo degradê suave — no iOS seria invisível e ainda custaria GPU por card em lista rolável.

Duas grandezas do vidro de nível 3, porém, **não** podem ser as mesmas nas duas plataformas, e as duas pelo mesmo motivo: sem blur o corpo do vidro é uma laje quase opaca, e tudo que se lê *em relação ao corpo* muda de leitura junto.

- **O preenchimento** precisa fechar mais, para ocultar o que passa por baixo sem o blur fazer esse trabalho (`--glass-fill-noblur`, `rgba(26,26,26,0.90)`).
- **O especular** precisa ceder. O `0.28 → 0.04` desta tabela pressupõe o material borrado: no iOS o backdrop levanta o corpo para ~`#3E3E3E` e a aresta fica 1,3x acima dele, que é luz raspando a quina. No Android o corpo cai em `#191919` e a mesma aresta fica 3,3x acima — deixa de ler como luz e vira uma linha branca desenhada em volta do pill. A variante sem blur é `0.16 → 0.03`, mirando ~2x: a aresta ainda define a forma, já que sem blur é só ela que separa o chrome do fundo, sem virar contorno. As três paradas caem na mesma proporção, para preservar a direção da luz que esta seção chama de obrigatória.

## 6. Visualização de dados (o elemento assinatura)

Este é o ponto onde o app deve ser reconhecível. Baseado nas refs:

- **Barras de progresso finas e pontilhadas** (tracinhos, não barra sólida cheia) para mostrar decorrer de tempo/fase — como o gráfico de sono.
- **Grade de pontos (dot-matrix)** para histórico/streak de treino ao longo do mês — pontos pequenos, apagados quando não há treino, cheios/brancos quando há. Não usar heatmap colorido tipo GitHub; manter em escala de cinza + 1 ponto em destaque se for recorde.
- Números sempre como protagonistas visuais (peso, volume levantado, horas de sono) — a cor de fundo do card pode inverter (fundo laranja sólido, texto preto) *apenas* no card que representa o dado mais importante da tela, como no card de sono. Isso é o "uso mínimo mas com contraste" que você pediu: em vez de accent como detalhe pequeno, ocasionalmente ele vira o fundo de UM card inteiro para chamar atenção. Esse é o único card que continua **sólido**: laranja translúcido perde o soco.

### Celula marcável

Toda superfície pequena que representa **um item marcável ou marcado** usa a mesma forma: **quadrado de cantos arredondados** (`--radius-square`, ~10px sobre um lado de 28–34px), nunca círculo. Vale para o dia do calendário e para a caixa de concluído do treino. O app tem uma linguagem só para isso — abrir uma segunda (círculo) faria duas coisas equivalentes parecerem de famílias diferentes.

O que muda entre os estados é **preenchimento e borda, nunca a forma nem o tamanho**: o quadrado tem a mesma caixa em todos os estados, e a borda existe mesmo quando é transparente, senão o conteúdo anda 1px ao entrar e sair do estado marcado.

Marcada, a célula é laranja **sólido** com glow (`--accent` + a mesma sombra de offset zero do card accent) e o ícone em `--bg`. O glow é o que faz o laranja ler como neon em vez de retângulo chapado, e precisa de um wrapper próprio: `overflow: hidden` na própria forma recorta a sombra junto.

## 7. O que evitar (sinais de "AI slop")

- Gradientes **coloridos** decorativos (roxo→rosa, azul→ciano) em qualquer botão ou fundo. Gradiente monocromático é permitido em exatamente dois lugares: a borda especular e o campo de luz (`--ambient`). Em nenhum outro.
- Glow/blur colorido atrás de ícones ou cards.
- **Vidro sem campo de luz por trás** — translucidez sobre fundo chapado é o "app slop" translúcido genérico. O erro nunca foi o vidro estar em superfície que não flutua; é não ter nada para atravessar.
- Vidro **colorido** (roxo, ciano). Aqui é branco puro, do campo à borda — é o que mais separa este material do slop.
- Grão ou ruído como "textura" decorativa, à procura de vibe analógica. O único ruído permitido é o do campo de luz, hoje a ~2 níveis — ele existe para mascarar banding, e se aparecer como textura subiu demais. Se ~2 níveis ainda não bastarem, a resposta não é subir mais: é trocar a arquitetura do campo.
- Emojis como substituto de ícone.
- Sombra pesada (`box-shadow` grande e difusa) em todo card — usar no máximo uma sombra sutil e só quando o card realmente flutua.
- Mais de uma cor de destaque na mesma tela (a caixa de concluído é a exceção documentada em §2 — e é a única).
- Cor de estado: verde de "ok", vermelho de "falhou". Estado se comunica por aceso/apagado na mesma matiz, ou por texto.
- Cantos arredondados com raios diferentes e aleatórios entre elementos do mesmo nível.
- Checkbox/toggle redondo. Célula marcável é quadrado de cantos arredondados (§6).
- Textos genéricos tipo "Bem-vindo de volta!", "Vamos treinar hoje?" — usar dado real e direto (número, hora, "Fridays", "31 min ago").
- Ícones 3D estilo "Fluent/emoji 3D".

## 8. Copy / microtexto

Direto, técnico, sem "vozinha animadora de app de fitness". Ex: `"Volume lifted"`, `"Body weight"`, `"Last 7 days"` — substantivo + dado, sem frase motivacional. Timestamps relativos e objetivos (`31 min ago`, `Yesterday · 14 Aug`).

## 10. Movimento

Esta seção foi escrita depois das outras, quando o app ganhou as primeiras animações. Ela não inventa uma linguagem nova: deriva do §1, que já decide tudo que importa aqui.

> Pense em painel de instrumento (velocímetro, equalizador, terminal), não em "app de bem-estar fofinho".

Ponteiro de instrumento é **criticamente amortecido**: vai até a leitura e para. Não passa do ponto, não volta, não quica. Toda animação do app é uma de duas coisas — **um valor se acomodando** (cor, opacidade) ou **um elemento entrando/saindo do layout**. Nada além disso.

### A regra da forma

**Movimento nunca muda forma nem tamanho.** É a frase do §6 sobre a célula marcável, estendida ao tempo: se o quadrado tem a mesma caixa em todos os *estados*, ele também tem a mesma caixa em toda a *transição* entre eles.

Isso proíbe, de uma vez: `scale` em feedback de toque, o "pop" na caixa de concluído, e pulso em qualquer coisa. O checkbox que estufa é a animação mais tentadora da lista e a que mais denuncia app genérico.

### A curva única

Uma curva no app inteiro: desaceleração pura, derivada final zero, **zero overshoot**. Sem `elastic`, `bounce` ou `back`.

**Nenhuma mola.** Só interpolação por tempo. Mola overshoota por definição, e sua duração é emergente — não dá para defender num comentário, que é como o resto desta base trabalha. Mola com bounce é a linguagem do app fofinho que o §1 rejeita pelo nome.

### Os dois gestos de toque, agora com tempo

Já existem e não mudam de significado: **"acende"** (superfície translúcida clareia) e **"apaga"** (chrome sólido baixa opacidade). Baixar opacidade de superfície translúcida apagaria o texto junto — não é o mesmo gesto, e é por isso que existem dois.

O que o movimento acrescenta é só que os dois **interpolam** na volta — e o gesto é **assimétrico**:

> **Confirmação de toque nunca tem rampa.** O dedo desce e a superfície responde no mesmo frame, como antes de existir animação. Só a subida do dedo relaxa.

Isso não é preguiça, é a correção de um erro que já aconteceu. A primeira versão animava a descida em 90ms; um toque rápido dura menos que isso, então a interpolação era interrompida no meio, a superfície acendia pela metade e voltava. O retorno ficava tão fraco que foi reportado como **hitbox menor que o botão** — que nunca foi. O dedo já está lá: qualquer duração na descida é latência pura, e a única coisa que ela pode fazer é chegar atrasada.

### O que não se anima

O §7 no eixo do tempo:

- Número contando/rolando. O número grande é o protagonista e muda a cada toque; animá-lo faria a tela nunca parar quieta, e um odômetro fala de si mesmo em vez de falar do dado.
- Gráfico preenchendo ou barras subindo em cascata na entrada da tela. É a assinatura de dashboard genérico.
- Shimmer/skeleton de carregamento.
- Glow pulsando — o §2 permite um sinal de atenção por tela, não um piscando.
- Campo de luz (`--ambient`) em movimento. O campo é arquitetura, não efeito.
- `ripple` do Android, que contradiz acende/apaga e faria o Android parecer outro app.

### Reduzir movimento é obrigatório

Toda animação fica atrás da preferência de sistema, sem exceção. O contrato é: **quem pediu menos movimento não pediu menos interface** — o estado final continua correto (a caixa fica laranja, o chip fica aceso), só a transição desaparece.

### Háptico

Só em **confirmação** — um gesto que escreve no banco. Nunca em navegação, rolagem, troca de aba, stepper ou seleção: o stepper sozinho dispararia dezenas de pulsos por exercício, e é isso que faz háptico parecer barato.

Um toque seco, do tipo que lê como interruptor mecânico. Nada da família de "sucesso/erro" — háptico de notificação é a versão tátil da cor de estado que o §7 proíbe. Não existe buzz verde de "ok".

## 11. Checklist antes de finalizar uma tela

- [ ] Só uma cor de destaque apareceu nesta tela? (Exceção única: as caixas de concluído do registro de treino, §2 — e nessa tela nada mais pode usar accent.)
- [ ] Toda célula marcável é quadrado de cantos arredondados, com a mesma caixa em todos os estados?
- [ ] O fundo é quase-preto (não preto puro, não cinza-azulado)?
- [ ] Os números grandes estão em mono, não em sans bold?
- [ ] Não tem gradiente colorido nem glow em lugar nenhum?
- [ ] Todo elemento de vidro tem campo de luz ou conteúdo real passando por trás?
- [ ] O que flutua está no nível 3 (esconde o que passa por baixo) e o que rola junto com a página, no nível 1?
- [ ] Ao rolar, os cards mudam de tom ao atravessar os halos? (Se não mudam, o campo está fraco demais e o vidro virou retângulo cinza.)
- [ ] O raio dos cantos é consistente entre elementos do mesmo nível?
- [ ] O copy é direto e usa dado real, sem frase de "app motivacional"?
- [ ] Nenhuma animação desta tela muda forma ou tamanho? (§10)
- [ ] Tudo que se move está atrás de "reduzir movimento", e o estado final continua correto sem ele? (§10)

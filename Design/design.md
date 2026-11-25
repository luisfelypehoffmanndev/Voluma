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

### Os donos do accent

O limite é um elemento accent por tela. Desde o reset do plano 16 (Onda 0), cada tipo de tela tem o seu dono **fixo**:

| Onde | Quem é o accent | Por quê |
|---|---|---|
| **As quatro telas de aba** (Hoje, Plano, Progresso, Perfil) | o **botão "Treinar"** no centro da barra | É a ação que existe de qualquer lugar do app: começar ou voltar ao treino de hoje. Ele é sólido, com glow e sem texto; o estado do dia aparece no ícone (ponto = em andamento, concluído = dia fechado). |
| **A sessão de treino** | o **contorno da série da vez** | É a resposta a "o que eu faço agora?", que a pessoa pergunta entre todas as séries. Ele fica no bloco herói da série, a carga em mono grande. |
| **Telas empilhadas** (resultado, catálogo, amigos…) | no máximo um elemento, escolhido pela tela | Não há barra, então o botão central não está lá. |

Consequências:

- **Nenhuma tela de aba usa accent em outro elemento.** O botão da Hoje, que já foi o accent da tela, virou vidro (nível 2) e mantém o rótulo com o estado ("Continuar treino · 2 de 16"). O botão central não tem espaço para dizer isso.
- **O dado de gráfico fica fora da conta** (§6): o seu dado veste o laranja e o de cada amigo, a cor dele. Um gráfico de Números na mesma tela do botão central não é um segundo accent, é identidade de pessoa num gráfico.
- **Telas de aba sem treino continuam com o botão laranja.** O limite é *no máximo* um, e a ação de treinar existe mesmo em dia de descanso ("Treino livre").

Botão accent é sólido com o mesmo glow do card accent, e texto ou ícone em preto (`textOnAccent`).

Nada de segunda cor de acento (sem verde de "sucesso", sem vermelho de "erro" decorativo). Estado negativo pode ser comunicado com texto/ícone em branco, não com cor.

### A exceção que caiu: a caixa de concluído

Até o plano 16, a caixa de concluído do treino era laranja, uma por série. Era a única exceção do limite de um accent por tela: a cor marcava um estado binário que se repete, e a leitura útil era a agregada (quantas caixas acesas).

**Ela caiu porque o laranja tinha um trabalho mais importante:** dizer qual é a próxima série. Com as caixas laranja, a próxima série só podia se destacar por luz, e a pessoa entre séries tinha de procurar onde estava. Agora a caixa marcada é **branca sólida**, com o ícone em `--bg`. Aceso e apagado na mesma matiz é exatamente o que §7 pede para estado, e a leitura agregada continua de relance: as caixas brancas são as feitas.

Não existe mais exceção ao limite de um accent por tela.

## 3. Tipografia

Duas famílias, papéis bem definidos — não uma pilha de 4 fontes "pra variar":

- **Display / números grandes (hora, peso, séries):** uma mono geométrica com traço fino — `Space Mono`, `JetBrains Mono` ou similar. É o que dá o ar "instrumento", como o relógio "08:26" das refs. Números grandes ficam com contorno fino (font-weight 300–400), não bold gordo.
- **UI / labels / corpo:** uma sans neutra e discreta — `Inter` ou `SF Pro`. Peso 400–500. Nunca itálico.

Escala (`fontSize` em `tokens.ts`): **oito papéis, um tamanho cada**. Eram dez tamanhos, com dois pares quase iguais (12/13, 15/16) que nenhuma tela usava de propósito. A diferença de 1px não se lê como hierarquia, só como descuido.

| Papel | Tamanho | Uso |
|---|---|---|
| `label` | 12, caixa alta, medium, espaçamento 0,8 | nome de campo: "VOLUME", "SÉRIE 3" |
| `aux` | 13 | metadado, linha de baixo; **piso da sessão de treino** |
| `body` | 16 | nome de exercício, item de lista, rótulo de botão |
| `section` | 20 | título de bloco: o treino do dia, o nome na sessão |
| `title` | 28 | título de tela |
| `numberLine` | 20, mono | número numa linha de tabela; leitura do HUD |
| `numberDisplay` | 34, mono | número de destaque dentro de um card |
| `numberHero` | 56, mono | **um por tela**: o número que responde a pergunta da tela |

O texto sobe ~1,25x por degrau (13 → 16 → 20 → 28). O número sobe ~1,65x (20 → 34 → 56), porque número é o protagonista e precisa de salto maior para se separar do texto em volta. Números secundários ficam menores e alinhados pela base, não pelo centro.

**Cor do texto auxiliar: `textAux` (`#ADADAD`), nunca `textSecondary`.** Toda superfície aqui é translúcida, e o fundo real de um texto é a pilha de alphas sobre o campo de luz. Sob o halo mais forte, o `#8A8A8A` de antes dava 3,0:1 na linha da série e 4,0:1 no card, abaixo dos 4,5:1 que texto pede. `textAux` foi calibrado pela conta (`contrast()` em `composite.ts`) para 4,6:1 na pior superfície do app, e o teste falha se alguém baixar o cinza ou subir um alpha. `textSecondary` continua para ícone apagado, desabilitado e texto direto sobre o fundo.

**A fonte do sistema escala, com teto por papel** (`FONT_SCALE_CAP` em `Text.tsx`). O corpo é o que mais cresce (até 2x), porque quem pediu fonte grande precisa ler o nome do exercício. Rótulo, título e número em coluna crescem menos (1,2–1,6x). Leituras de painel e números grandes param em 1,2x, porque já são grandes e dividem a largura em colunas fixas. Sem teto, no maior tamanho do iOS (~310%) o nome virava "Su…" ao lado do alvo, o volume do HUD desmontava e o "Finalizar treino" era cortado.

Os dois degraus do meio — `Section` (19) e `Title` (30) — entraram depois, e por um motivo registrado: sem eles o app inteiro vivia entre 12 e 16px, nada era manifestamente mais importante que o resto e nenhuma tela dizia por onde começar a ler. Hierarquia aqui é **tamanho e espaço**, não cor: o brief só tem uma cor para gastar, e ela já tem dono.

Cada tela de aba tem **um herói**: o treino do dia na Hoje, a semana no Plano. O resto desce de tamanho e ganha um rótulo de seção em caixa alta (`Label`), que é o que separa "agir" de "consultar".

## 4. Layout

- Cards com `border-radius` grande e consistente (20–28px), mas **não em tudo indiscriminadamente** — o raio deve ser o mesmo em toda a hierarquia de um mesmo nível (todos os cards de nível 1 com o mesmo raio).
- Grid tipo bento: blocos de tamanhos diferentes conforme a importância do dado (ex: peso corporal grande, calendário de streak menor), como no print do app de treino.
- Espaçamento generoso. Respiro > densidade. Se parece PDF de planilha, tem elemento demais na tela.
- **O espaçamento tem papéis** (`layout` em `tokens.ts`), por cima da escala de 4 (`spacing`): margem da tela 20, recuo do card 20, vão entre cards 12, vão antes de um rótulo de seção 28. A escala diz *quanto*; o papel diz *para quê*. Sem os papéis, o mesmo vão caía em valores diferentes de tela para tela.
- **Alvo de toque mínimo de 48dp, com 8dp de respiro** (`layout.touch`, `layout.touchGap`), em tudo o que se toca durante o treino. O desenho pode ser menor (a caixa marcável tem 32, o botão do stepper tem 44), mas o `hitSlop` completa até 48. Botão preenchido, não só contorno: o olho mira o que vê, e um círculo de contorno fino é lido menor do que é.
- **Linha de tabela em vez de card dentro de card.** As séries que não são a da vez são linhas com divisor, sem caixa própria. Só a da vez ganha superfície (nível 2). Antes cada série era um card dentro do card, e quatro séries enchiam a tela.
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

- **Gráficos de evolução com a forma mais óbvia para o dado:** barra vertical para quantidade por período (volume por semana, dias por semana), linha com área em degradê para evolução (carga, peso) e barra horizontal sobre trilho para partes de um todo (volume por grupo). Todo gráfico tem a escala de números redondos à direita e o nome dos meses embaixo, e nenhum precisa de legenda explicando a leitura.
- **O dado veste a cor de quem ele é, com glow:** o seu é o laranja da marca, e cada amigo tem a cor dele (`people` em `tokens.ts`). Só a moldura (grade, eixos, textos) fica em cinza. Isso vale para os gráficos, e o dado de gráfico não conta como o accent da tela (§2). Fora deles, o accent continua em no máximo um elemento por tela, e a grade de treinos (dot-matrix) continua cinza.
- **Grade de pontos (dot-matrix)** para histórico/streak de treino ao longo do mês — pontos pequenos, apagados quando não há treino, cheios/brancos quando há. Não usar heatmap colorido tipo GitHub; manter em escala de cinza + 1 ponto em destaque se for recorde.
- Números sempre como protagonistas visuais (peso, volume levantado, a carga da série da vez). Existia um card de fundo laranja sólido para o dado mais importante de uma tela (o "card de sono" das referências). Ele saiu no plano 16: nenhuma tela o usava, e com o accent das abas no botão central e o da sessão na série da vez, não sobrou tela onde ele pudesse existir sem ser o segundo laranja.

### Celula marcável

Toda superfície pequena que representa **um item marcável ou marcado** usa a mesma forma: **quadrado de cantos arredondados** (`--radius-square`, ~10px sobre um lado de 28–34px), nunca círculo. Vale para o dia do calendário e para a caixa de concluído do treino. O app tem uma linguagem só para isso — abrir uma segunda (círculo) faria duas coisas equivalentes parecerem de famílias diferentes.

O que muda entre os estados é **preenchimento e borda, nunca a forma nem o tamanho**: o quadrado tem a mesma caixa em todos os estados, e a borda existe mesmo quando é transparente, senão o conteúdo anda 1px ao entrar e sair do estado marcado.

Marcada, a célula é **branca sólida** (`--text-primary`) com o ícone em `--bg`. Desmarcada, ela tem só a borda (`borderStrong`). Não tem glow nem cor: até o plano 16 ela era laranja, e a exceção que isso abria no §2 foi desfeita (ver "A exceção que caiu"). O desenho tem 32 de lado e o alvo de toque tem 48.

## 7. O que evitar (sinais de "AI slop")

- Gradientes **coloridos** decorativos (roxo→rosa, azul→ciano) em qualquer botão ou fundo. Gradiente monocromático é permitido em exatamente dois lugares: a borda especular e o campo de luz (`--ambient`). Em nenhum outro.
- Glow/blur colorido atrás de ícones ou cards.
- **Vidro sem campo de luz por trás** — translucidez sobre fundo chapado é o "app slop" translúcido genérico. O erro nunca foi o vidro estar em superfície que não flutua; é não ter nada para atravessar.
- Vidro **colorido** (roxo, ciano). Aqui é branco puro, do campo à borda — é o que mais separa este material do slop.
- Grão ou ruído como "textura" decorativa, à procura de vibe analógica. O único ruído permitido é o do campo de luz, hoje a ~2 níveis — ele existe para mascarar banding, e se aparecer como textura subiu demais. Se ~2 níveis ainda não bastarem, a resposta não é subir mais: é trocar a arquitetura do campo.
- Emojis como substituto de ícone.
- Sombra pesada (`box-shadow` grande e difusa) em todo card — usar no máximo uma sombra sutil e só quando o card realmente flutua.
- Mais de uma cor de destaque na mesma tela. Não há exceção desde o plano 16. O dado de gráfico com a cor da pessoa (§6) não conta como destaque.
- Cor de estado: verde de "ok", vermelho de "falhou". Estado se comunica por aceso/apagado na mesma matiz, ou por texto.
- Cantos arredondados com raios diferentes e aleatórios entre elementos do mesmo nível.
- Checkbox/toggle redondo. Célula marcável é quadrado de cantos arredondados (§6).
- Textos genéricos tipo "Bem-vindo de volta!", "Vamos treinar hoje?" — usar dado real e direto (número, hora, "Fridays", "31 min ago").
- Ícones 3D estilo "Fluent/emoji 3D".

## 8. Copy / microtexto

Direto, técnico, sem "vozinha animadora de app de fitness". Ex: `"Volume lifted"`, `"Body weight"`, `"Last 7 days"` — substantivo + dado, sem frase motivacional. Timestamps relativos e objetivos (`31 min ago`, `Yesterday · 14 Aug`).

## 9. A dica da primeira visita (tour)

Cada tela tem, na primeira visita, **uma dica**: o resto da tela escurece, um elemento continua aceso com um contorno em volta, e um painel diz numa frase o que ele faz. Uma vez por tela, por aparelho, e nunca mais — quem já viu só reencontra em **Perfil → Ajuda → Ver as dicas de novo**.

Ela existe porque o app pedia conhecimento que não estava em lugar nenhum: que o treino se registra série a série, que o dia da semana é que guarda os exercícios. A resposta não é encher a interface de instruções; é mostrar uma vez, no lugar certo.

As regras que ela respeita, e que valem para qualquer dica futura:

- **Sem accent.** A dica aparece por cima de uma tela que já gastou o seu único destaque (§2). O destaque dela é luz — o escurecido em volta —, não cor.
- **Uma frase por passo, no máximo dois passos por tela.** E a frase vale em qualquer estado do dia: falar do número de séries numa tela de descanso seria mentira.
- **"Pular" sempre disponível**, e o voltar do Android fecha a dica.
- **Não é `Modal`.** Desmontar um `Modal` do RN ainda visível deixa a janela nativa pendurada — tela preta nas duas plataformas. A dica é uma camada absoluta no `overlay` do `Screen`.
- **A posição é medida, nunca assumida**: o alvo em coordenadas de janela, a camada medindo a própria origem, e a medida se repetindo enquanto a dica está aberta (a lista rola, o card abre, o teclado entra).
- O raio do contorno acompanha a forma do que ele aponta: pílula no botão, raio de card no bloco (§11).

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

### A única exceção: a abertura do onboarding

O onboarding é o único lugar do app com uma **entrada de cinema**: o campo de luz acende a partir do escuro, as sete barras do ícone crescem uma a uma até a de hoje (em laranja), "Voluma" surge e o botão aparece por último. Na tela de volume, o número conta até o novo valor a cada toque.

A exceção se sustenta pelo mesmo raciocínio da caixa de concluído (§2): o que a regra impede é a tela que nunca para quieta, e isto acontece **uma vez na vida do usuário**. Não vira ruído porque não se repete.

O limite continua valendo:
- A curva é a mesma `SETTLE`, sem mola e sem overshoot. As barras crescem pela altura, ancoradas na base, como uma leitura sendo medida.
- "Reduzir movimento" zera duração **e atraso**: tudo aparece no primeiro quadro.
- O campo de luz não se move. A cortina que o cobre é que some.
- Fora do onboarding nada disso vale. Barras em cascata numa tela comum continuam proibidas.

Na abertura o accent é a barra de hoje, e por isso o botão "Começar" é vidro.

### Reduzir movimento é obrigatório

Toda animação fica atrás da preferência de sistema, sem exceção. O contrato é: **quem pediu menos movimento não pediu menos interface** — o estado final continua correto (a caixa fica laranja, o chip fica aceso), só a transição desaparece.

### Háptico

Só em **confirmação** — um gesto que escreve no banco. Nunca em navegação, rolagem, troca de aba, stepper ou seleção: o stepper sozinho dispararia dezenas de pulsos por exercício, e é isso que faz háptico parecer barato.

Um toque seco, do tipo que lê como interruptor mecânico. Nada da família de "sucesso/erro" — háptico de notificação é a versão tátil da cor de estado que o §7 proíbe. Não existe buzz verde de "ok".

## 11. Checklist antes de finalizar uma tela

- [ ] Só uma cor de destaque apareceu nesta tela? Nas abas, ela é o botão central; na sessão, a série da vez (§2).
- [ ] Todo texto auxiliar está em `textAux` (ou num papel de `Text.tsx` que já o usa), e não em `textSecondary` sobre card?
- [ ] Tudo o que se toca tem alvo de 48dp com 8dp de respiro?
- [ ] A tela aguenta a fonte do sistema no maior tamanho sem cortar, sobrepor ou empurrar alvo para fora da tela?
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

## 12. O HUD da sessão

Durante o treino, a tela responde três perguntas **sem rolar**: o que eu faço agora, quanto falta e quanto já fiz.

- **Topo fixo** (`SessionHud`): o nome do treino e uma linha de três leituras de painel, com o rótulo em cima e o número em mono embaixo: **SÉRIES** `8/14` · **VOLUME** `4250 kg` · **TEMPO** `32:15`. Ele **nasce compacto e não encolhe ao rolar**. O pedido original era um topo que compacta com a rolagem, mas isso é animar tamanho, e o §10 proíbe. O volume de 56px, que ocupava o primeiro quarto da tela, desceu para esta linha.
- **O número herói é a carga da série da vez**, em mono de 56px, com as reps ao lado em 34. Ele é lido com o celular apoiado no banco, a um braço de distância. O número **é o campo**: tocar abre o teclado numérico (60 → 80 kg em duas interações), e os botões embaixo só têm − e +. Segurar repete e acelera, sem háptico. O contorno do bloco é o único accent da tela (§2).
- **O relógio** conta a partir do toque em "Treinar" (`startSession` reinicia `started_at` enquanto nada foi marcado). Ele é sempre `agora − início`, nunca um contador somado, e por isso volta certo do segundo plano. Fica num componente isolado para a tela não renderizar a cada segundo.
- **Rodapé fixo**: "Finalizar treino · N de M", em vidro. É também o lugar do cronômetro de descanso, que chega no plano 16, Onda 4.
- **No meio**, só o exercício da vez fica aberto. As séries feitas e as que ainda vêm são linhas de tabela, e terminar um exercício fecha o card e rola até o próximo.


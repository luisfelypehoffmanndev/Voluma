# Design System — App de Academia (uso pessoal)

> Este documento é um brief de design para guiar qualquer ferramenta (Claude, Cursor, Figma, etc.) na construção da interface. O objetivo é fugir do "cara de app gerado por IA": nada de gradientes decorativos, glow roxo/azul, ícones fofos genéricos ou cards com sombra pesada em tudo. A referência é dashboard técnico + widget de iOS: frio, preciso, quase de instrumento de medição.

## 1. Princípio central

Preto e branco fazem 95% do trabalho. Cor só aparece para **uma coisa que precisa de atenção imediata** (um recorde, uma meta batida, um alerta). Se dois elementos da mesma tela usam cor, um deles está errado.

Pense em painel de instrumento (velocímetro, equalizador, terminal), não em "app de bem-estar fofinho".

## 2. Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0A0A0A` | fundo base, quase preto (nunca `#000` puro — mata a profundidade) |
| `--surface` | `#161616` | cards e superfícies elevadas |
| `--glass-fill` | `rgba(255,255,255,0.10)` | preenchimento do vidro, por cima do blur |
| `--glass-border` | `rgba(255,255,255,0.12)` | contorno do vidro |
| `--glass-specular` | gradiente branco `0.28 → 0.04` | brilho na borda superior do vidro — luz raspando a quina |
| `--ambient` | branco radial a `0.04` | brilho atrás do conteúdo rolável, para o vidro ter o que borrar |
| `--border` | `rgba(255,255,255,0.08)` | bordas de 1px, nunca mais grossas |
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
- Divisores são linhas de 1px em `--border`, nunca sombra difusa simulando linha.
- Ícones: outline, peso fino, monocromáticos (branco ou secondary), nunca preenchidos coloridos. Wi-fi/bluetooth como nas refs — puramente funcionais, sem badge, sem cor.

## 5. O vidro (glass)

O vidro não é enfeite ocasional: é **camada estrutural**. A regra é uma só e resolve todo caso duvidoso:

> **O que flutua é vidro. O que é conteúdo é sólido.**

Flutuam — e portanto são vidro: barra inferior, modais, botões fixos sobre a lista, cabeçalho que gruda ao rolar. Não flutuam — e portanto são sólidos: cards do bento, linhas de série, qualquer coisa que role junto com a página.

```css
background: rgba(255, 255, 255, 0.10);
backdrop-filter: blur(28px) saturate(140%);
border: 1px solid rgba(255, 255, 255, 0.12);
/* brilho especular: gradiente na borda superior, não linha chapada */
border-image: linear-gradient(rgba(255,255,255,0.28), rgba(255,255,255,0.04)) 1;
```

**Vidro sobre fundo liso é mentira.** Se nada passa por trás, o efeito não existe e você acabou de fazer um retângulo cinza caro. Duas consequências práticas:

- O conteúdo rolável precisa passar *por baixo* da superfície de vidro, não parar antes dela.
- Sobre um fundo quase-preto e chapado, o blur não tem luminância com que trabalhar. Por isso existe o `--ambient`: um brilho branco radial fraquíssimo atrás do conteúdo. Sem ele o vidro fica cinza morto por mais blur que se aplique.

O **brilho especular** na borda superior é o que separa "vidro Apple" de "retângulo translúcido". Ele é gradiente, não linha de cor sólida — a luz é mais forte na quina e some descendo.

### Android

`expo-blur` no Android tem `experimentalBlurMethod` com default `'none'`, que **não desfoca nada** — cai para uma view semi-transparente. Toda superfície de vidro precisa de `experimentalBlurMethod="dimezisBlurView"`, ou o efeito simplesmente não existe no aparelho.

É um método experimental e custa performance. Sobre listas roláveis, se houver engasgo, reduza a intensidade antes de desligar o método.

## 6. Visualização de dados (o elemento assinatura)

Este é o ponto onde o app deve ser reconhecível. Baseado nas refs:

- **Barras de progresso finas e pontilhadas** (tracinhos, não barra sólida cheia) para mostrar decorrer de tempo/fase — como o gráfico de sono.
- **Grade de pontos (dot-matrix)** para histórico/streak de treino ao longo do mês — pontos pequenos, apagados quando não há treino, cheios/brancos quando há. Não usar heatmap colorido tipo GitHub; manter em escala de cinza + 1 ponto em destaque se for recorde.
- Números sempre como protagonistas visuais (peso, volume levantado, horas de sono) — a cor de fundo do card pode inverter (fundo laranja sólido, texto preto) *apenas* no card que representa o dado mais importante da tela, como no card de sono. Isso é o "uso mínimo mas com contraste" que você pediu: em vez de accent como detalhe pequeno, ocasionalmente ele vira o fundo de UM card inteiro para chamar atenção.

## 7. O que evitar (sinais de "AI slop")

- Gradientes **coloridos** decorativos (roxo→rosa, azul→ciano) em qualquer botão ou fundo. Gradiente monocromático é permitido em exatamente dois lugares: a borda especular do vidro e o `--ambient`. Em nenhum outro.
- Glow/blur colorido atrás de ícones ou cards.
- Vidro em superfície que não flutua — translucidez sem nada por trás é o "app slop" translúcido genérico.
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
- [ ] Todo elemento de vidro tem conteúdo real passando por trás?
- [ ] Todo elemento que flutua sobre conteúdo é de vidro?
- [ ] O raio dos cantos é consistente entre elementos do mesmo nível?
- [ ] O copy é direto e usa dado real, sem frase de "app motivacional"?

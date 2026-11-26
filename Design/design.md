# Design do Voluma (padrão Blink)

> Fonte de verdade de interface desde 2026-11-26. Substitui o brief anterior (vidro, halos, laranja neon, números em mono), que está no histórico do git. A referência é o outro app do Gabriel, o **Blink**, adaptado para treino: simples, prático e bonito.

## 1. Princípio

Monocromático. O chrome do app não tem cor própria. Hierarquia vem de **tamanho, peso e espaço**, não de cor.

Cor aparece só quando comunica significado:
- **verde (`success`)**: série concluída, recorde, meta batida;
- **vermelho (`error`)**: erro e ação destrutiva;
- **gráfico com amigos**: cada pessoa tem uma cor de uma paleta curta e dessaturada (`people.friends`), e "você" é `primary`. É a única exceção decorativa, e só dentro do gráfico.

Nada de gradiente decorativo, glow, sombra pesada, ícone colorido ou emoji na interface.

## 2. Cores

Tema escuro é o padrão; os tokens do claro já estão prontos (`palette` e `useThemeColors()` em `src/theme/tokens.ts`).

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `background` | `#000000` | `#e2e2df` | fundo de toda tela |
| `surfaceContainerLow` | `#0a0a0a` | `#e7e7e4` | faixa sutil, fundo de lista agrupada |
| `surfaceContainer` | `#121212` | `#ecece9` | **card** padrão |
| `surfaceContainerHigh` | `#1c1c1e` | `#d9d9d6` | input, item selecionado, chip inativo, bloco da série da vez |
| `surfaceContainerHighest` | `#2c2c2e` | `#cececb` | trilho de progresso, divisor forte |
| `surfaceBright` | `#3a3a3c` | `#f1f1ee` | pressionado, botão − e + dentro do bloco da série |
| `primary` | `#c9c9c9` | `#111111` | texto de destaque, ícone ativo |
| `primaryContainer` | `#bdbdbd` | `#111111` | **botão principal**, chip ativo, progresso, dia treinado |
| `onPrimary` | `#000000` | `#f7f7f5` | texto sobre `primaryContainer` |
| `onSurface` | `#c9c9c9` | `#111111` | texto principal |
| `onSurfaceVariant` | `#a1a1aa` | `#52525b` | texto auxiliar, metadado, rótulo |
| `outline` | `#71717a` | `#78787d` | ícone inativo, placeholder |
| `outlineVariant` | `#2c2c2e` | `#cdcdca` | borda de 1px, divisor |
| `success` | `#22c55e` | `#15803d` | concluído, recorde |
| `error` | `#f4212e` | `#d92d20` | erro, excluir |

- **Nunca branco puro sobre preto puro.** Texto e destaque são `#c9c9c9` (~12:1), não `#ffffff` (21:1 vibra e cansa).
- **No claro, nunca `#ffffff` no fundo nem no card.**
- Card se separa do fundo por **degrau de cinza**, não por borda grossa ou sombra.
- Os testes em `src/theme/__tests__/composite.test.ts` travam o contraste: texto principal ≥ 7:1 em toda superfície de conteúdo, auxiliar ≥ 4,5:1, ícone inativo ≥ 3:1, e o principal abaixo de 15:1 sobre o fundo.

## 3. Tipografia

- **Plus Jakarta Sans** (700, 800): títulos, nomes de treino e **todos os números grandes**, com `fontVariant: ['tabular-nums']` em número que muda.
- **Inter** (400, 500, 600): corpo, rótulos, botões, metadados.

| Papel | Tamanho / altura | Família |
|---|---|---|
| `xs` | 12 / 16 | Inter 500, rótulo e metadado |
| `sm` | 14 / 20 | Inter 400/500, apoio |
| `base` | 16 / 24 | Inter 500/600, nome de exercício, item, botão |
| `lg` | 18 / 28 | Jakarta 700, título de card |
| `xl` | 20 / 28 | Jakarta 700, título de seção |
| `2xl` | 24 / 32 | Jakarta 800, título de tela secundária, exercício da vez |
| `3xl` | 30 / 36 | Jakarta 800, título de aba |
| número herói | 44 a 56 | Jakarta 800, letter-spacing -0.03em, **um por tela** |

Rótulo de seção em caixa alta só onde ajuda a escanear ("SEMANA", "EXERCÍCIOS"), Inter 12, `onSurfaceVariant`. O teto de escala da fonte do sistema por papel (`FONT_SCALE_CAP` em `src/ui/Text.tsx`) continua.

## 4. Forma e espaço

- Raio: **card 18**, **botão e input 14**, **pílula** totalmente arredondada (`shape` em `tokens.ts`). Iguais em todo o app.
- Espaçamento base de 4. Margem da tela 20, padding do card 16 a 20, vão entre cards 12, vão antes de um título de seção 28.
- Alvo de toque mínimo 44 (48 durante o treino).
- Largura máxima do conteúdo 720 (iPad), centralizada.
- **Linha com divisor, não card dentro de card.**

## 5. Componentes

- **Button**: `primary` (fundo `primaryContainer`, texto `onPrimary`) e `inline` (fundo `surfaceContainerHigh`). Altura 50, raio 14, Inter 600 16. Pressionado 0.8, desabilitado 0.5.
- **Card**: `surfaceContainer` opaco, raio 18, borda de 1px `rgba(255,255,255,0.12)`, sombra suave.
- **Stepper de carga e reps** (bloco da série da vez): número grande no centro (Jakarta 800, tabular), botões − e + de 48, toque longo acelera, toque no número abre o teclado.
- **Chip e Segmented**: pílula; ativo em `primaryContainer` com texto `onPrimary`, inativo em `surfaceContainerHigh`.
- **Célula marcável**: quadrado arredondado; marcada em `success` com check.
- **Barra de abas**: largura cheia, opaca (`background`, divisor de 1px em cima), colada no fundo, Ionicons **sem rótulo**, 26, contorno quando inativo (`outline`) e preenchido quando ativo (`onSurface`), 52 + área segura. **Sem botão central**: começar o treino é o botão principal da aba Hoje.
- **Sheet e modal**: fundo `surfaceContainer`, fundo atrás escurecido. Ação destrutiva em `error`, sempre com confirmação ou desfazer.
- **Estado vazio**: ícone de contorno, uma frase do que fazer e um botão que resolve.
- **Ícones**: Ionicons em todo o app (`src/ui/icons.tsx`), contorno por padrão, preenchido para ativo, monocromáticos.

## 6. Movimento e toque

- Entradas curtas (200 a 300 ms), ease-out, leve deslocamento para cima e fade.
- Número que muda **rola** (contagem curta) em vez de trocar seco.
- Barra de progresso e anel **enchem** ao aparecer.
- Háptico só em: marcar série (leve), concluir treino (sucesso), recorde (sucesso), excluir (aviso).
- Respeite "Reduzir movimento" do sistema.

## 7. Telas

- **Hoje**: o treino do dia como herói (nome em Jakarta 800 3xl, exercícios e tempo estimado), botão primary largo "Começar treino (N exercícios)" ou "Continuar treino · 5 de 16 séries" com barra fina. Abaixo, a semana em 7 círculos (treinados em `primaryContainer`) e os exercícios do dia em linhas.
- **Sessão**: no topo, o exercício da vez (2xl) e "Série 3 de 4". O bloco da série da vez em `surfaceContainerHigh`, com os steppers de carga e reps já preenchidos e o botão primary largo "Concluir série". Séries feitas com check verde, futuras em `onSurfaceVariant`. Rodapé fixo com o progresso e "Finalizar treino".
- **Resultado**: todo número com comparação ("+6% sobre a última segunda-feira"); recorde com selo verde; botão "Concluir".
- **Plano**: os 7 dias em lista, com o nome do treino e quantos exercícios, ou "Descanso".
- **Histórico**: Segmented (Calendário, Números, Amigos); calendário em grade estilo mapa de atividade em tons de cinza.
- **Perfil**: lista agrupada em cards, cada linha com ícone de contorno à esquerda e chevron à direita.
- **Onboarding**: curto, com o modelo Push/Pull/Legs pré-selecionado.

## 8. Experiência

- **Padrão inteligente**: pré-preencha o que a maioria escolhe (carga e reps da última vez).
- **Progresso nunca começa do zero.**
- **Comparação, não número solto.**
- **Perda pesa mais que ganho**: "Treine hoje para não perder a sequência de 12 dias".
- **Microtexto específico**: "Concluir série", "Começar treino (6 exercícios)".
- **Nada destrutivo a um toque.**

## 9. Texto

- Português do Brasil, frases curtas e diretas.
- **Sem travessão (— ou –) em nenhum texto que a pessoa lê no app.** Use vírgula, dois pontos ou ponto. Confira com `grep -rn "[—–]" app src` (comentário de código não conta).
- Evite frases com cara de IA.

## Checklist antes de finalizar uma tela

- [ ] Só cinzas no chrome; cor apenas em `success`, `error` ou gráfico de amigos?
- [ ] Nada translúcido, nenhum glow, nenhum gradiente decorativo?
- [ ] Títulos e números grandes em Plus Jakarta Sans; números que mudam com `tabular-nums`?
- [ ] Raios 18 (card), 14 (botão e input) e pílula, sem variação?
- [ ] Uma coisa grande por tela, e um botão principal que diz o que fazer?
- [ ] Alvos de toque de 44 (48 no treino)?
- [ ] Nenhum travessão em texto visível?
- [ ] Nada cortado ou sobreposto, inclusive com a fonte do sistema no máximo?

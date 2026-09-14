/**
 * A conta que ancora a escada de densidade.
 *
 * Todas as superficies do app sao branco translucido: o valor que aparece na
 * tela nao esta escrito em lugar nenhum, ele *resulta* do alpha da superficie
 * com o que passa por tras. Sem esta conta, escolher um alpha e chute — e
 * mexer num alpha depois e chute sem aviso.
 *
 * Por isso ela e uma funcao pura, testada contra os valores que o design
 * assumiu: se alguem trocar um token de `tokens.ts`, o teste falha e mostra em
 * que cinza a superficie foi parar.
 *
 * O app inteiro e neutro (branco sobre cinza), entao um canal basta — nao ha
 * matiz para carregar.
 */

/** Branco a `alpha` sobre um fundo de valor `base`, ambos em 0–255. */
export function over(alpha: number, base: number): number {
  return base + alpha * (255 - base);
}

/** Empilha varias camadas translucidas, da mais funda para a mais rasa. */
export function stack(base: number, ...alphas: readonly number[]): number {
  return alphas.reduce((value, alpha) => over(alpha, value), base);
}

/** O alpha de uma string `rgba(r,g,b,a)` — o formato dos tokens de superficie. */
export function alphaOf(rgba: string): number {
  const alpha = rgba.match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/);
  if (!alpha) throw new Error(`Nao e uma cor rgba(): ${rgba}`);
  return Number(alpha[1]);
}

/** O valor de cinza de um hex `#RRGGBB`. */
export function grayOf(hex: string): number {
  const channel = hex.match(/^#([0-9a-f]{2})/i);
  if (!channel) throw new Error(`Nao e um hex #RRGGBB: ${hex}`);
  return parseInt(channel[1], 16);
}

/**
 * O alpha de uma camada branca que leva uma superficie de `from` ate `to`.
 *
 * O feedback de toque nao troca mais o `backgroundColor` da superficie: ele
 * acende uma camada por cima. A razao e de toque, nao de estilo — animar a cor
 * do proprio `Pressable` exigia embrulha-lo num componente animado, e isso
 * mexeu na area de toque (reportado como "erra o botao"). Camada sobreposta com
 * `pointerEvents: none` deixa o `Pressable` intocado.
 *
 * Mas empilhar 0,05 sobre 0,06 NAO da 0,11: a segunda camada so pinta o que a
 * primeira deixou passar. Resolvendo `over(a, over(from, F)) = over(to, F)`
 * para `a`, o `F` cancela e sobra a conta abaixo — o alpha certo independe do
 * que estiver por tras, que e o que permite usar um valor fixo sobre o campo de
 * luz inteiro.
 */
export function overlayAlpha(from: number, to: number): number {
  return (to - from) / (1 - from);
}

/** O caminho de volta: de valor para `#RRGGBB`, para conferir contra o design. */
export function grayHex(value: number): string {
  const channel = Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${channel}${channel}${channel}`;
}

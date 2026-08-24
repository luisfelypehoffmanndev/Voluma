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

/** O caminho de volta: de valor para `#RRGGBB`, para conferir contra o design. */
export function grayHex(value: number): string {
  const channel = Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${channel}${channel}${channel}`;
}

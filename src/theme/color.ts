export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** `#RRGGBB` → `rgba(r,g,b,alpha)`, no formato que o resto do tema ja usa. */
export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Luminancia relativa do WCAG 2.x. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razao de contraste do WCAG, de 1 (mesma cor) a 21 (preto e branco). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Valores em coordenadas de tela para os graficos de linha.
 *
 * O eixo Y nao comeca no zero: a progressao de uma carga anda 2,5 kg sobre
 * 60 kg, e um eixo ancorado no zero achataria tudo numa reta. A folga de 10%
 * em cima e embaixo impede que o ponto mais alto e o mais baixo encostem na
 * borda. Serie constante (ou um ponto so) fica no meio da altura.
 */
export function plotPoints(
  values: readonly number[],
  width: number,
  height: number,
  inset: number,
): { x: number; y: number }[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const pad = span > 0 ? span * 0.1 : 0;
  const low = min - pad;
  const range = span + pad * 2;

  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: values.length > 1 ? inset + step * index : width / 2,
    y: range > 0 ? inset + (1 - (value - low) / range) * innerHeight : height / 2,
  }));
}

/** "+7,5" / "−2,9" / "0": a variacao com sinal, no formato de peso do app. */
export function signedDelta(delta: number, format: (value: number) => string): string {
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : '−'}${format(Math.abs(delta))}`;
}

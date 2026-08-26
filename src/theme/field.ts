import { grayOf, over } from './composite';
import { ambient, colors } from './tokens';

/**
 * Amostrar o campo de luz num ponto qualquer da tela.
 *
 * Existe porque nem toda superficie consegue simplesmente deixar o campo passar.
 * A tab bar e o caso: sem blur no Android, ser translucida de verdade deixaria o
 * conteudo rolavel aparecer atraves dela, e esconder isso e a razao de ela
 * existir como nivel 3. Mas ha uma assimetria aproveitavel — o campo e **fixo**
 * (o `Ambient` nao rola) e o conteudo e que se move. Entao a barra pode ser
 * opaca ao conteudo e ainda assim *pintar* o campo que estaria atras dela.
 *
 * Vidro pintado, nao vidro furado. E o unico jeito de o nivel 3 obedecer a regra
 * do brief — "o que muda de um nivel para o outro e a densidade, nao a materia" —
 * num sistema onde metade das plataformas nao tem blur.
 *
 * A conta vive aqui, e nao no componente, para que a barra nunca vire uma
 * segunda fonte de verdade: mexer num halo de `ambient` move a barra junto.
 *
 * Nota de geometria: o raio de um halo e eliptico — `r` multiplica largura e
 * altura. Entao, em coordenadas normalizadas, a distancia ate o centro nao
 * depende do aspecto da tela, e amostrar o campo nao precisa de dimensao
 * nenhuma. E por isso que estas funcoes sao puras.
 */

/** `'85%'` -> `0.85`. O formato em que os halos guardam posicao e raio. */
function fraction(percent: string): number {
  const match = percent.match(/^(-?[\d.]+)%$/);
  if (!match) throw new Error(`Nao e uma porcentagem: ${percent}`);
  return Number(match[1]) / 100;
}

/**
 * O peso da queda a uma distancia `d` do centro do halo, com `d` em raios:
 * 0 no centro, 1 na borda. Interpola a curva de `ambient.falloff`, que aproxima
 * uma gaussiana justamente para nao ter quina na derivada — quina vira anel.
 */
export function falloffAt(d: number): number {
  const curve = ambient.falloff;
  if (d <= 0) return curve[0].weight;
  if (d >= 1) return 0;

  for (let i = 1; i < curve.length; i += 1) {
    const prev = curve[i - 1];
    const next = curve[i];
    if (d <= next.offset) {
      const t = (d - prev.offset) / (next.offset - prev.offset);
      return prev.weight + t * (next.weight - prev.weight);
    }
  }
  return 0;
}

/**
 * O valor de cinza (0–255) do campo em `(x, y)`, ambos em fracao da tela —
 * `(0, 0)` e o canto superior esquerdo, `(1, 1)` o inferior direito.
 *
 * E a mesma composicao que o `Ambient` manda o Android desenhar, so que em
 * numero: os halos empilhados na ordem, cada um branco sobre o resultado do
 * anterior.
 */
export function fieldGrayAt(x: number, y: number): number {
  let value = grayOf(colors.bg);

  for (const halo of ambient.halos) {
    const radius = fraction(halo.r);
    const dx = (x - fraction(halo.cx)) / radius;
    const dy = (y - fraction(halo.cy)) / radius;
    value = over(halo.opacity * falloffAt(Math.hypot(dx, dy)), value);
  }

  return value;
}

/**
 * O alpha de branco que, sobre o fundo base, resulta em `gray`.
 *
 * O caminho de volta de `over()`: e o que permite exprimir um trecho do campo
 * como stops de gradiente em vez de cores chapadas.
 */
export function whiteAlphaFor(gray: number): number {
  const base = grayOf(colors.bg);
  return (gray - base) / (255 - base);
}

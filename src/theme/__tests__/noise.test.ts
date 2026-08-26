import { readFileSync } from 'fs';
import { join } from 'path';
import { inflateSync } from 'zlib';

/**
 * O grao e mascara, nao enfeite: `Design/design.md` §7 proibe ele virar textura
 * visivel, e `scripts/make-noise.js` fixa 4 como teto de amplitude.
 *
 * Este teste existe porque a violacao desse teto ja aconteceu e passou batido
 * num commit — um `MAX_ALPHA = 30` de diagnostico foi commitado junto com os
 * PNGs gerados a partir dele, e nada no projeto acusou. O que chega no aparelho
 * sao os arquivos, nao a constante, entao e neles que a trava tem de morder.
 */

/** Teto de amplitude do grao, em unidades de alpha 0–255. */
const MAX_ALPHA = 4;

/** Base do app, `colors.bg` — o quanto o grao pode levantar dela e o que importa. */
const BG = 10;

const DENSITIES = ['noise.png', 'noise@2x.png', 'noise@3x.png'];

/** Le um PNG RGBA sem filtro, do jeito que `make-noise.js` escreve. */
function readRGBA(file: string): { size: number; alpha: number[] } {
  const png = readFileSync(join(__dirname, '../../../assets', file));

  // IHDR vem logo depois da assinatura de 8 bytes: 4 de tamanho + 4 do tipo.
  const size = png.readUInt32BE(16);
  expect(png.readUInt32BE(20)).toBe(size); // quadrado
  expect(png[24]).toBe(8); // 8 bits por canal
  expect(png[25]).toBe(6); // RGBA

  // Concatena os IDAT e infla.
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));

  const alpha: number[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = y * (1 + size * 4);
    expect(raw[row]).toBe(0); // filtro None, senao a leitura abaixo nao vale
    for (let x = 0; x < size; x += 1) {
      alpha.push(raw[row + 1 + x * 4 + 3]);
    }
  }
  return { size, alpha };
}

describe.each(DENSITIES)('%s', (file) => {
  it('respeita o teto de amplitude do grao', () => {
    const { alpha } = readRGBA(file);
    expect(Math.max(...alpha)).toBeLessThanOrEqual(MAX_ALPHA);
  });

  it('mantem o fundo quase-preto', () => {
    const { alpha } = readRGBA(file);
    const mean = alpha.reduce((a, b) => a + b, 0) / alpha.length;

    // Branco a `mean/255` sobre a base: o brief aceita #0A0A0A -> #0C0C0C.
    const lifted = BG + (mean / 255) * (255 - BG);
    expect(lifted).toBeLessThanOrEqual(13);
  });

  it('cobre a faixa toda, senao a distribuicao triangular degenerou', () => {
    const { alpha } = readRGBA(file);
    expect(new Set(alpha).size).toBe(MAX_ALPHA + 1);
  });
});

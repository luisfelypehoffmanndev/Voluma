/**
 * Gera `assets/noise@3x.png` — o grao que quebra o banding do campo de luz.
 *
 * O problema: o campo do `Ambient` vai de #0A0A0A a #202020, ou seja 22 niveis
 * de cinza espalhados pela tela inteira. Isso da dezenas de pixels por degrau, e
 * o olho enxerga cada degrau como um anel. Nenhuma quantidade de blur ou de
 * stops a mais resolve — o problema e quantizacao de 8 bits, nao suavidade.
 *
 * A solucao e a de sempre em video e impressao: dither. Ruido de amplitude ~1
 * nivel por cima do gradiente faz a fronteira entre dois degraus virar uma
 * mistura dos dois em vez de uma linha.
 *
 * Duas escolhas que valem explicacao:
 *
 * - **Alpha 0, 1 ou 2 em 255.** Branco a alpha `a` sobre um fundo `B` soma
 *   `a·(255−B)`; com B entre 10 e 32, alpha 1 vale ~0,96 nivel. E exatamente a
 *   amplitude que dither pede: menos nao atravessa a fronteira do degrau, mais
 *   vira textura visivel. O ruido so soma (nao da para subtrair compondo por
 *   cima), entao o fundo sobe ~1 nivel na media — #0A vira #0B.
 * - **`@3x` no nome.** O tile e desenhado no tamanho intrinseco em dp; sem o
 *   sufixo, num aparelho 3x cada pixel de ruido viraria um bloco de 3x3 pixels
 *   interpolado, e a interpolacao suaviza justamente a variancia que faz o
 *   dither funcionar. Com `@3x` o pior caso vira reducao, que preserva o ruido.
 *
 * Rodar: node scripts/make-noise.js
 */

const { deflateSync } = require('zlib');
const { writeFileSync } = require('fs');
const { join } = require('path');

const SIZE = 128;
/** Alpha maximo, em 1/255. Suba para 3 se ainda aparecer anel; 2 ja e visivel como textura. */
const MAX_ALPHA = 2;
const OUT = join(__dirname, '..', 'assets', 'noise@3x.png');

// LCG com semente fixa: o mesmo arquivo sai igual toda vez que alguem regerar.
let seed = 0x2545f491;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bits por canal
ihdr[9] = 6; // RGBA
// compressao, filtro e interlace ficam em 0 — o resto do buffer ja e zero.

// Uma linha = 1 byte de filtro (0 = None) + SIZE pixels RGBA.
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
let offset = 0;
for (let y = 0; y < SIZE; y += 1) {
  raw[offset] = 0;
  offset += 1;
  for (let x = 0; x < SIZE; x += 1) {
    const alpha = Math.floor(random() * (MAX_ALPHA + 1));
    // Branco puro: o brief nao admite ruido tingido, e o campo e monocromatico.
    raw[offset] = 255;
    raw[offset + 1] = 255;
    raw[offset + 2] = 255;
    raw[offset + 3] = alpha;
    offset += 4;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`${OUT} — ${SIZE}x${SIZE}, alpha 0..${MAX_ALPHA}, ${png.length} bytes`);

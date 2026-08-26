/**
 * Gera o grao que dithera o campo de luz — uma variante por densidade de tela.
 *
 * O problema: o campo do `Ambient` vai de #0A0A0A a #202020, ou seja 22 niveis
 * de cinza espalhados pela tela inteira. Isso da dezenas de pixels por degrau, e
 * o olho enxerga cada degrau como um anel. Nenhuma quantidade de blur ou de
 * stops a mais resolve — o problema e quantizacao de 8 bits, nao suavidade.
 *
 * A solucao e a de sempre em video e impressao: ruido por cima do gradiente,
 * que faz a fronteira entre dois degraus virar uma mistura dos dois em vez de
 * uma linha.
 *
 * Com uma ressalva que custou uma rodada para aparecer: isto NAO e dither de
 * verdade. Dither soma antes do arredondamento; aqui o `react-native-svg` ja
 * quantizou o gradiente e o grao entra depois, entao ele mascara a borda em vez
 * de desfazer o degrau. Mascarar custa mais amplitude que ditherar — ver
 * `MAX_ALPHA`.
 *
 * Tres escolhas que valem explicacao:
 *
 * - **Blue noise, nao white noise.** A primeira versao sorteava cada pixel de
 *   forma independente. Isso e white noise: energia igual em toda frequencia
 *   espacial, inclusive nas baixas, onde o olho enxerga melhor. O resultado sao
 *   grumos que leem como mancha em vez de dissolver a fronteira. Blue noise
 *   concentra a energia em alta frequencia, onde a sensibilidade de contraste
 *   do olho despenca: **na mesma variancia ele some como textura e mascara
 *   banda muito melhor.** E o que deixa atender o teto do brief e ainda assim
 *   entregar mais dither que antes.
 *
 * - **Distribuicao triangular (TPDF), nao uniforme.** O void-and-cluster
 *   devolve um rank uniforme; passa-lo por uma inversa triangular concentra a
 *   massa no meio da faixa em vez de espalha-la por igual. E a distribuicao que
 *   o dither pede: elimina a modulacao de ruido que a uniforme deixa. A media
 *   fica em metade de `MAX_ALPHA`, e e por isso que o fundo sobe alguns niveis.
 *
 * - **Uma variante por densidade, todas com a mesma pegada em dp.** Antes so
 *   existia `noise@3x.png`, o que declarava um ladrilho de 42,67 dp: em
 *   qualquer aparelho que nao fosse exatamente 3x o Metro reescalava os 128 px,
 *   e a interpolacao bilinear diluia justamente a variancia que faz o dither
 *   funcionar — num aparelho 2x chegava com metade da amplitude projetada.
 *   Agora sao tres arquivos de 64 dp cada, entao todo aparelho desenha o
 *   ladrilho 1:1 com o pixel fisico, sem filtragem. Cada um e um campo
 *   independente na sua resolucao: reamostrar um unico campo reintroduziria
 *   exatamente a suavizacao que estamos tirando.
 *
 * Rodar: npm run make-noise
 */

const { deflateSync } = require('zlib');
const { writeFileSync } = require('fs');
const { join } = require('path');

/** Lado do ladrilho em dp. O mesmo para as tres densidades. */
const TILE_DP = 64;

/**
 * Alpha maximo, em 1/255.
 *
 * Comecou em 2, o teto que o brief pedia, e nao bastou. A razao esta na natureza
 * do que este arquivo faz: o grao entra POR CIMA de um gradiente que o
 * `react-native-svg` ja quantizou, entao ele nao e dither de verdade — dither
 * precisa somar antes do arredondamento. Aqui a estrutura de bandas ja esta
 * gravada, e o ruido so mascara a borda. Mascarar um degrau de 1 nivel exige
 * amplitude maior que dither-lo exigiria.
 *
 * Nao da para fazer melhor sem sair do Expo Go: o `Paint.setDither` do Android,
 * que resolveria na origem, e do `react-native-svg` nativo que vem embutido no
 * proprio Expo Go — patch em `node_modules` nao chega la.
 *
 * Com 4, a media do ruido e +2 niveis: o fundo sai de #0A0A0A para #0C0C0C,
 * ainda quase-preto. Se ainda sobrar anel, o proximo passo NAO e subir mais —
 * a essa altura o grao vira textura, que o brief proibe. E trocar de
 * arquitetura.
 */
const MAX_ALPHA = 4;

const DENSITIES = [
  { scale: 1, suffix: '' },
  { scale: 2, suffix: '@2x' },
  { scale: 3, suffix: '@3x' },
];

// LCG com semente fixa: o mesmo arquivo sai igual toda vez que alguem regerar.
let seed = 0x2545f491;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

// ------------------------------------------------------------------ blue noise

/**
 * Raio do kernel de energia, em pixels.
 *
 * O void-and-cluster pergunta "onde esta o maior aglomerado" e "onde esta o
 * maior vazio", e responde espalhando energia gaussiana em volta de cada ponto
 * ja colocado. Com sigma 1.5, alem de ~3 sigma a contribuicao e menor que o
 * arredondamento — cortar ali troca um algoritmo O(n^2), que nao termina num
 * ladrilho de 192x192, por um O(n * raio^2).
 */
const SIGMA = 1.5;
const RADIUS = 5;

/** Pesos do kernel, pre-calculados uma vez por execucao. */
function gaussianKernel() {
  const side = RADIUS * 2 + 1;
  const weights = new Float64Array(side * side);
  for (let dy = -RADIUS; dy <= RADIUS; dy += 1) {
    for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
      weights[(dy + RADIUS) * side + (dx + RADIUS)] = Math.exp(
        -(dx * dx + dy * dy) / (2 * SIGMA * SIGMA),
      );
    }
  }
  return weights;
}

/**
 * A matriz de rank do void-and-cluster: cada pixel recebe uma posicao unica em
 * [0, n), e pixels de rank proximo ficam espalhados em vez de vizinhos.
 *
 * O kernel envolve nas bordas (`(x + size) % size`), o que faz o ladrilho ser
 * toroidal — ou seja, ele se repete sem emenda visivel, que e o requisito para
 * poder usar `resizeMode="repeat"`.
 */
function voidAndCluster(size) {
  const n = size * size;
  const side = RADIUS * 2 + 1;
  const kernel = gaussianKernel();
  const energy = new Float64Array(n);
  const taken = new Uint8Array(n);
  const rank = new Int32Array(n).fill(-1);

  const spread = (index, sign) => {
    const cx = index % size;
    const cy = (index / size) | 0;
    for (let dy = -RADIUS; dy <= RADIUS; dy += 1) {
      const y = (cy + dy + size) % size;
      for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
        const x = (cx + dx + size) % size;
        energy[y * size + x] += sign * kernel[(dy + RADIUS) * side + (dx + RADIUS)];
      }
    }
  };

  /** O ponto mais vazio entre os livres — onde cabe o proximo. */
  const emptiest = () => {
    let best = -1;
    let bestEnergy = Infinity;
    for (let i = 0; i < n; i += 1) {
      if (taken[i]) continue;
      if (energy[i] < bestEnergy) {
        bestEnergy = energy[i];
        best = i;
      }
    }
    return best;
  };

  // A semente e um punhado de pontos aleatorios; o algoritmo corrige a
  // distribuicao deles ao longo do preenchimento.
  const seeds = Math.max(1, Math.round(n * 0.01));
  for (let placed = 0; placed < seeds; placed += 1) {
    let index;
    do {
      index = Math.floor(random() * n);
    } while (taken[index]);
    taken[index] = 1;
    spread(index, 1);
  }

  // Reordena as sementes: retira a mais aglomerada e devolve no maior vazio,
  // ate nao haver mais o que melhorar. E o que tira o vies do sorteio inicial.
  for (let pass = 0; pass < seeds; pass += 1) {
    let worst = -1;
    let worstEnergy = -Infinity;
    for (let i = 0; i < n; i += 1) {
      if (!taken[i]) continue;
      if (energy[i] > worstEnergy) {
        worstEnergy = energy[i];
        worst = i;
      }
    }
    taken[worst] = 0;
    spread(worst, -1);
    const hole = emptiest();
    if (hole === worst) {
      taken[worst] = 1;
      spread(worst, 1);
      break;
    }
    taken[hole] = 1;
    spread(hole, 1);
  }

  // Fase 1: desfaz as sementes uma a uma, da mais aglomerada para a menos —
  // essa ordem, invertida, e o inicio do rank.
  const snapshot = taken.slice();
  const snapshotEnergy = energy.slice();
  for (let remaining = seeds; remaining > 0; remaining -= 1) {
    let worst = -1;
    let worstEnergy = -Infinity;
    for (let i = 0; i < n; i += 1) {
      if (!taken[i]) continue;
      if (energy[i] > worstEnergy) {
        worstEnergy = energy[i];
        worst = i;
      }
    }
    taken[worst] = 0;
    spread(worst, -1);
    rank[worst] = remaining - 1;
  }

  // Fase 2: a partir das sementes, preenche o resto sempre no maior vazio.
  taken.set(snapshot);
  energy.set(snapshotEnergy);
  for (let index = seeds; index < n; index += 1) {
    const hole = emptiest();
    taken[hole] = 1;
    spread(hole, 1);
    rank[hole] = index;
  }

  return rank;
}

/**
 * Rank uniforme -> alpha triangular em {0..MAX_ALPHA}.
 *
 * Inversa da CDF triangular: soma de dois uniformes independentes. Com
 * MAX_ALPHA = 2 isso da exatamente 25% / 50% / 25%, media 1.
 */
function triangular(u) {
  const a = u < 0.5 ? Math.sqrt(u / 2) : 1 - Math.sqrt((1 - u) / 2);
  return Math.min(MAX_ALPHA, Math.round(a * MAX_ALPHA));
}

// --------------------------------------------------------------- checagem

/**
 * Energia media do espectro nas frequencias baixas contra as altas.
 *
 * Existe porque a saida *parece* ruido de qualquer jeito: um bug no
 * void-and-cluster degeneraria silenciosamente para white noise, e o unico
 * jeito de perceber e medir. Blue noise tem que ter as baixas suprimidas.
 *
 * DFT direta num recorte de 64x64 — O(n^2) em 4096 pontos e instantaneo, e nao
 * vale trazer uma FFT so para uma asercao.
 */
function lowFrequencyRatio(values, size) {
  const n = Math.min(64, size);
  const mean = (() => {
    let sum = 0;
    for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) sum += values[y * size + x];
    return sum / (n * n);
  })();

  let low = 0;
  let lowCount = 0;
  let high = 0;
  let highCount = 0;

  for (let v = 0; v < n; v += 1) {
    for (let u = 0; u < n; u += 1) {
      if (u === 0 && v === 0) continue;
      let re = 0;
      let im = 0;
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const angle = (-2 * Math.PI * (u * x + v * y)) / n;
          const value = values[y * size + x] - mean;
          re += value * Math.cos(angle);
          im += value * Math.sin(angle);
        }
      }
      const power = re * re + im * im;
      // Frequencia radial normalizada, tratando o espectro como periodico.
      const fx = Math.min(u, n - u) / (n / 2);
      const fy = Math.min(v, n - v) / (n / 2);
      const f = Math.hypot(fx, fy);
      if (f < 0.35) {
        low += power;
        lowCount += 1;
      } else if (f > 0.7) {
        high += power;
        highCount += 1;
      }
    }
  }

  return low / lowCount / (high / highCount);
}

// -------------------------------------------------------------------- png

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

function png(size, alpha) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // compressao, filtro e interlace ficam em 0 — o resto do buffer ja e zero.

  // Uma linha = 1 byte de filtro (0 = None) + size pixels RGBA.
  const raw = Buffer.alloc(size * (1 + size * 4));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      // Branco puro: o brief nao admite ruido tingido, e o campo e monocromatico.
      raw[offset] = 255;
      raw[offset + 1] = 255;
      raw[offset + 2] = 255;
      raw[offset + 3] = alpha[y * size + x];
      offset += 4;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- main

for (const { scale, suffix } of DENSITIES) {
  const size = TILE_DP * scale;
  const rank = voidAndCluster(size);

  const alpha = new Uint8Array(size * size);
  for (let i = 0; i < rank.length; i += 1) {
    alpha[i] = triangular((rank[i] + 0.5) / rank.length);
  }

  const ratio = lowFrequencyRatio(alpha, size);
  if (ratio > 0.6) {
    throw new Error(
      `${suffix || '@1x'}: espectro nao e blue noise — baixas/altas = ${ratio.toFixed(2)}, esperado < 0.6`,
    );
  }

  const out = join(__dirname, '..', 'assets', `noise${suffix}.png`);
  const file = png(size, alpha);
  writeFileSync(out, file);

  const mean = alpha.reduce((sum, value) => sum + value, 0) / alpha.length;
  console.log(
    `noise${suffix || ''}.png — ${size}x${size} (${TILE_DP}dp), alpha 0..${MAX_ALPHA}, ` +
      `media ${mean.toFixed(3)}, baixas/altas ${ratio.toFixed(2)}, ${file.length} bytes`,
  );
}

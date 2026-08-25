/**
 * Vendoriza a arte dos movimentos do workout-guide para `src/movements/`.
 *
 * De onde vem: https://github.com/bryllim/workout-guide — 302 exercicios, tres
 * frames cada, CC BY-SA 4.0 (ver ATTRIBUTION.md na raiz).
 *
 * Por que copiar em vez de instalar o pacote:
 *
 * - O `@bryllim/workout-guide` publicado no npm so traz os PNGs. Os SVGs
 *   existem apenas no repositorio, entao `getAssetUrl()` — que aponta para
 *   `.svg` no jsDelivr — devolve 404. Instalar o pacote nao resolveria.
 * - Todo SVG de la e UM unico `<path fill="#fff" fill-rule="evenodd">` num
 *   viewBox 512x512. Guardando so a string `d`, a figura vira exatamente o que
 *   `src/ui/icons.tsx` ja desenha a mao com `react-native-svg`: sem
 *   dependencia nova, sem transformer no Metro, e com a cor vindo do tema em
 *   vez de branco chumbado no arquivo.
 *
 * O commit e fixado, nao `main`: a saida e commitada, entao rodar de novo seis
 * meses depois nao pode produzir um diff que ninguem pediu.
 *
 * Duas saidas:
 *
 * - `src/movements/art/<slug>.ts` — um arquivo por movimento ilustrado. Um
 *   arquivo so, com os ~2,9 MB juntos, trava editor e diff.
 * - `src/movements/data.ts` — slug, musculo, equipamento e tipo dos 288
 *   movimentos da biblioteca (os 302 menos os 14 alongamentos). E o manifesto
 *   destilado; o nome em portugues fica em `names.pt.ts`, escrito a mao.
 *
 * Rodar: npm run vendor:art
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const COMMIT = 'ba0b709cb20430361b2cb33aaadd20998164a916';
const BASE = `https://cdn.jsdelivr.net/gh/bryllim/workout-guide@${COMMIT}/packages/workout-guide`;

const HERE = dirname(fileURLToPath(import.meta.url));
const MOVEMENTS = join(HERE, '..', 'src', 'movements');
const ART = join(MOVEMENTS, 'art');

/**
 * Quantas casas decimais sobrevivem em cada coordenada.
 *
 * A arte foi vetorizada a partir de raster de 512x512, entao a precisao alem da
 * primeira casa e ruido do tracador, nao desenho. Uma casa corta ~26% do peso
 * com erro maximo de 0,05 px num canvas de 512 — invisivel em qualquer tamanho
 * em que a figura aparece no app.
 */
const PRECISION = 1;

/**
 * Folga de cada lado do desenho, em fracao do lado do quadro.
 *
 * A caixa medida e aproximada (ver `bounds`), e figura encostando na borda le
 * como recorte mesmo quando nao ha recorte nenhum.
 */
const PADDING = 0.04;

/**
 * Os movimentos que ganham figura.
 *
 * Sao os 59 de `COMMON_EXERCISES` (src/db/catalog.ts) mais a corrida: cada frame
 * pesa ~15 KB de string no bundle, entao ilustrar os 288 da biblioteca custaria
 * ~13 MB. Os outros aparecem com placeholder ate alguem promove-los aqui.
 *
 * A ordem e a de `COMMON_EXERCISES`, e `library.test.ts` garante que os dois
 * conjuntos nao saiam de sincronia.
 */
const ILLUSTRATED_SLUGS = [
  // Peito
  'bench-press',
  'incline-bench-press',
  'decline-bench-press',
  'dumbbell-bench-press',
  'dumbbell-fly',
  'cable-fly',
  'pec-deck',
  'push-up',
  'chest-dip',

  // Costas
  'pull-up',
  'lat-pulldown',
  'barbell-row',
  'seated-row',
  'one-arm-dumbbell-row',
  't-bar-row',
  'deadlift',
  'straight-arm-pulldown',
  'shrug',

  // Pernas
  'squat',
  'front-squat',
  'leg-press',
  'hack-squat',
  'leg-extension',
  'seated-leg-curl',
  'lying-leg-curl',
  'romanian-deadlift',
  'forward-lunge',
  'bulgarian-split-squat',
  'standing-calf-raise',
  'seated-calf-raise',
  'hip-adduction-machine',
  'hip-abduction-machine',

  // Gluteos
  'hip-thrust',
  'cable-kickback',
  'machine-glute-kickback',

  // Ombros
  'overhead-press',
  'arnold-press',
  'lateral-raise',
  'front-raise',
  'rear-delt-fly',
  'face-pull',
  'upright-row',

  // Biceps
  'ez-bar-curl',
  'bicep-curl',
  'hammer-curl',
  'preacher-curl',
  'concentration-curl',
  'cable-curl',

  // Triceps
  'rope-tricep-pushdown',
  'tricep-pushdown',
  'skull-crusher',
  'overhead-tricep-extension',
  'tricep-kickback',
  'bench-dip',

  /**
   * A corrida.
   *
   * Fora de `COMMON_EXERCISES` porque ela nasce sob demanda em
   * `ensureRunExercise`, mas e o unico movimento que o app trata como item fixo
   * do catalogo — e o ramo `run` do editor de alvos ficaria sem figura nenhuma
   * sem ela.
   */
  'running',

  // Abdomen
  'crunch',
  'reverse-crunch',
  'plank',
  'lying-leg-raise',
  'cable-crunch',
];

const LICENSE_HEADER = `/**
 * GERADO por scripts/vendor-movement-art.mjs — nao editar a mao.
 *
 * Arte de Bryl Lim (https://bryllim.com), do projeto workout-guide, derivada de
 * Everkinetic. Licenca CC BY-SA 4.0 —
 * https://creativecommons.org/licenses/by-sa/4.0/
 *
 * Alteracoes: extraido o atributo \`d\` do path unico de cada SVG e arredondadas
 * as coordenadas para ${PRECISION} casa decimal. Ver ATTRIBUTION.md.
 */
`;

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  return response.text();
}

/**
 * O `d` do path unico do SVG.
 *
 * Falha ruidosamente se o arquivo tiver mais de um elemento de desenho: a
 * garantia de path unico e o que sustenta o desenho inteiro, e um dia em que
 * ela deixar de valer precisa quebrar aqui, nao virar figura pela metade na
 * tela.
 */
function extractPath(svg, url) {
  const elements = [...svg.matchAll(/<(\w+)[\s/>]/g)].map((match) => match[1]);
  const drawn = elements.filter((tag) => tag !== 'svg');
  if (drawn.length !== 1 || drawn[0] !== 'path') {
    throw new Error(`esperava um <path> unico, achei [${drawn.join(', ')}] em ${url}`);
  }

  const d = /<path[^>]*\sd="([^"]+)"/.exec(svg);
  if (!d) throw new Error(`<path> sem atributo d em ${url}`);
  return d[1];
}

/**
 * Quantos parametros cada comando de path consome por repeticao.
 *
 * Repeticao implicita: `c` com 12 numeros sao duas curvas, e um `m` com quatro
 * numeros e um moveto seguido de um lineto (por isso `m` vira `l` depois do
 * primeiro par).
 */
const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/**
 * Nas elipses, os dois parametros que NAO sao numero.
 *
 * `large-arc-flag` e `sweep-flag` sao um digito so, e a gramatica permite
 * escrever `0 011.5` querendo dizer flag 0, flag 1, coordenada 1.5. Ler isso
 * como o numero 011.5 e o tipo de erro que passa despercebido ate a figura sair
 * torta, entao o parser trata os indices 3 e 4 de `a` como caso proprio.
 */
const ARC_FLAGS = [3, 4];

/**
 * Quebra o `d` em segmentos `{ command, params }`.
 *
 * Existe porque a alternativa obvia — um regex de numero passado por cima da
 * string inteira — esta errada de duas formas, e as duas produzem figura
 * corrompida em silencio:
 *
 * 1. A notacao compacta encosta numeros sem separador: `18.035.558` sao DOIS
 *    numeros. Arredondar o primeiro para `18` cola os dois num `18.558` so.
 * 2. As flags de arco descritas acima.
 */
function parsePath(d, url) {
  const scanner = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)|([\s,]+)/y;
  const segments = [];
  let command = null;
  let params = [];
  let index = 0;

  const flush = () => {
    if (!command) return;
    const arity = ARITY[command.toLowerCase()];
    if (arity === 0) {
      segments.push({ command, params: [] });
    } else {
      if (params.length === 0 || params.length % arity !== 0) {
        throw new Error(`${command} com ${params.length} parametros em ${url}`);
      }
      for (let at = 0; at < params.length; at += arity) {
        // Repeticao implicita: so o primeiro grupo mantem a letra original.
        const repeated = at === 0 ? command : implicit(command);
        segments.push({ command: repeated, params: params.slice(at, at + arity) });
      }
    }
    params = [];
  };

  while (index < d.length) {
    scanner.lastIndex = index;
    const match = scanner.exec(d);
    if (!match) throw new Error(`caractere inesperado em ${JSON.stringify(d.slice(index, index + 12))} — ${url}`);
    index = scanner.lastIndex;

    if (match[3]) continue;
    if (match[1]) {
      flush();
      command = match[1];
      continue;
    }
    if (!command) throw new Error(`numero antes de qualquer comando em ${url}`);

    // Flag de arco: um digito, e o scanner de numero teria engolido o proximo.
    const arity = ARITY[command.toLowerCase()];
    if (command.toLowerCase() === 'a' && ARC_FLAGS.includes(params.length % arity)) {
      const flag = match[2][0];
      if (flag !== '0' && flag !== '1') throw new Error(`flag de arco invalida ${flag} em ${url}`);
      params.push(flag);
      // O resto do token era a coordenada seguinte, colada na flag.
      if (match[2].length > 1) index = index - (match[2].length - 1);
      continue;
    }

    params.push(match[2]);
  }

  flush();
  return segments;
}

/**
 * A caixa que o desenho ocupa de fato, em coordenadas absolutas.
 *
 * Existe porque a arte de origem nao usa o quadro de 512 de forma consistente:
 * medindo os 60 movimentos, a ocupacao media e 351x417, mas `cable-curl` usa
 * 188 de largura e `straight-arm-pulldown` fica com 207 de margem a esquerda
 * contra 87 a direita. Desenhar todos com `viewBox="0 0 512 512"` faz cada
 * figura sair de um tamanho aparente diferente, e as assimetricas saem tortas.
 *
 * Os pontos de controle das curvas entram na conta, o que da uma caixa
 * ligeiramente maior que a tinta real — de proposito: errar para fora deixa
 * folga, errar para dentro corta o desenho.
 *
 * Os arcos entram so pelos extremos. Esta arte usa arcos de raio enorme
 * (`a 29796 29796 ...`), que sao retas disfarcadas; limita-los pelo raio daria
 * uma caixa de 60000px.
 */
function bounds(segments) {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  const hit = (px, py) => {
    if (px < box.minX) box.minX = px;
    if (px > box.maxX) box.maxX = px;
    if (py < box.minY) box.minY = py;
    if (py > box.maxY) box.maxY = py;
  };

  for (const { command, params } of segments) {
    const p = params.map(Number);
    const rel = command === command.toLowerCase();
    const kind = command.toLowerCase();
    const ax = (v) => (rel ? x + v : v);
    const ay = (v) => (rel ? y + v : v);

    if (kind === 'm' || kind === 'l' || kind === 't') {
      x = ax(p[0]);
      y = ay(p[1]);
      if (kind === 'm') {
        startX = x;
        startY = y;
      }
      hit(x, y);
    } else if (kind === 'h') {
      x = ax(p[0]);
      hit(x, y);
    } else if (kind === 'v') {
      y = ay(p[1 - 1]);
      hit(x, y);
    } else if (kind === 'c' || kind === 's' || kind === 'q') {
      const n = kind === 'c' ? 6 : 4;
      for (let k = 0; k < n; k += 2) hit(ax(p[k]), ay(p[k + 1]));
      x = ax(p[n - 2]);
      y = ay(p[n - 1]);
    } else if (kind === 'a') {
      x = ax(p[5]);
      y = ay(p[6]);
      hit(x, y);
    } else if (kind === 'z') {
      x = startX;
      y = startY;
    }
  }

  return box;
}

/**
 * O `viewBox` quadrado que enquadra os TRES frames juntos.
 *
 * A uniao, e nao uma caixa por frame: enquadrar cada pose no seu proprio limite
 * faria a figura pular de escala e de posicao a cada troca de frame, que e
 * exatamente o contrario de mostrar um movimento.
 *
 * Quadrado porque `MovementFigure` desenha num quadrado — um viewBox retangular
 * deixaria o `preserveAspectRatio` reintroduzir a margem que este calculo
 * acabou de tirar.
 */
function viewBoxFor(frames, url) {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const d of frames) {
    const b = bounds(parsePath(d, url));
    box.minX = Math.min(box.minX, b.minX);
    box.minY = Math.min(box.minY, b.minY);
    box.maxX = Math.max(box.maxX, b.maxX);
    box.maxY = Math.max(box.maxY, b.maxY);
  }

  const side = Math.max(box.maxX - box.minX, box.maxY - box.minY) * (1 + PADDING * 2);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const fmt = (value) => Number(value.toFixed(1));
  return `${fmt(cx - side / 2)} ${fmt(cy - side / 2)} ${fmt(side)} ${fmt(side)}`;
}

/** Depois do primeiro par, `m` continua como `l` — o resto repete a si mesmo. */
function implicit(command) {
  if (command === 'm') return 'l';
  if (command === 'M') return 'L';
  return command;
}

/**
 * Arredonda as coordenadas e reemite o path com separador explicito.
 *
 * Reemitir com espaco em vez de devolver a notacao compacta e deliberado: o
 * ganho de alguns bytes nao paga o risco de dois numeros voltarem a encostar, e
 * `react-native-svg` reclama menos de path espacado do que de path apertado.
 */
function round(d, url) {
  return parsePath(d, url)
    .map(({ command, params }) => {
      const arity = ARITY[command.toLowerCase()];
      const values = params.map((value, at) =>
        command.toLowerCase() === 'a' && ARC_FLAGS.includes(at % arity)
          ? value
          : String(Number(Number(value).toFixed(PRECISION))),
      );
      return command + values.join(' ');
    })
    .join('');
}

async function vendorArt() {
  mkdirSync(ART, { recursive: true });

  let total = 0;
  for (const slug of ILLUSTRATED_SLUGS) {
    const frames = [];
    for (const index of [1, 2, 3]) {
      const url = `${BASE}/assets/${slug}/frame-${index}.svg`;
      frames.push(round(extractPath(await fetchText(url), url), url));
    }

    const body = frames.map((d) => `  '${d}',`).join('\n');
    const box = viewBoxFor(frames, `${slug} (viewBox)`);
    writeFileSync(
      join(ART, `${slug}.ts`),
      `${LICENSE_HEADER}
export const frames = [
${body}
] as const;

/** Enquadra os tres frames juntos, sem a margem morta do quadro de origem. */
export const viewBox = '${box}';
`,
    );
    total += frames.join('').length;
    process.stdout.write(`  ${slug}\n`);
  }

  // Um slug removido de ILLUSTRATED_SLUGS tem que sumir do disco, senao o
  // barrel e o bundle carregam peso que ninguem referencia.
  //
  // Apaga arquivo a arquivo em vez de recriar a pasta inteira, de proposito: o
  // `rmSync` recursivo que morava aqui fazia o watcher do Metro ver
  // `src/movements/art` desaparecer e cachear a ausencia, e o proximo bundle
  // quebrava com "Unable to resolve module ./art" mesmo com tudo no lugar.
  const wanted = new Set(ILLUSTRATED_SLUGS);
  for (const file of readdirSync(ART)) {
    if (!file.endsWith('.ts') || file === 'index.ts') continue;
    if (!wanted.has(file.replace(/\.ts$/, ''))) rmSync(join(ART, file));
  }

  const slugs = [...wanted].sort();

  const imports = slugs
    .map(
      (slug) =>
        `import { frames as ${identifier(slug)}, viewBox as ${identifier(slug)}Box } from './${slug}';`,
    )
    .join('\n');
  const entries = slugs.map((slug) => `  '${slug}': ${identifier(slug)},`).join('\n');
  const boxes = slugs.map((slug) => `  '${slug}': ${identifier(slug)}Box,`).join('\n');

  writeFileSync(
    join(ART, 'index.ts'),
    `${LICENSE_HEADER}
${imports}

/** Os tres frames de cada movimento ilustrado, na ordem da animacao. */
export const FRAMES: Readonly<Record<string, readonly [string, string, string]>> = {
${entries}
};

/**
 * O quadro de cada movimento, ja apertado em volta do desenho.
 *
 * Sem isto toda figura usaria o quadro de origem de 512, que a arte ocupa de
 * forma irregular — de 188 a 482 de largura. O efeito era cada figura sair de
 * um tamanho aparente diferente, e as assimetricas sairem deslocadas.
 */
export const VIEW_BOXES: Readonly<Record<string, string>> = {
${boxes}
};
`,
  );

  console.log(`\n${slugs.length} movimentos, ${(total / 1024 / 1024).toFixed(2)} MB de path`);
}

/** `bench-press` -> `benchPress`, para o barrel. */
function identifier(slug) {
  return slug.replace(/-(\w)/g, (_, char) => char.toUpperCase());
}

async function vendorData() {
  const manifest = JSON.parse(await fetchText(`${BASE}/manifest.json`));

  // Alongamento fica de fora: nao e movimento de treino registravel em series
  // ou distancia, que e tudo que o app sabe medir.
  const rows = manifest
    .filter((exercise) => !exercise.isStretch)
    .map(
      (exercise) =>
        `  ['${exercise.slug}', '${exercise.primaryMuscle}', '${exercise.equipment}', '${exercise.exerciseType}'],`,
    );

  writeFileSync(
    join(MOVEMENTS, 'data.ts'),
    `/**
 * GERADO por scripts/vendor-movement-art.mjs — nao editar a mao.
 *
 * O manifesto do workout-guide destilado: slug, musculo primario, equipamento e
 * tipo, sem os ${manifest.length - rows.length} alongamentos. O nome em portugues de cada slug esta em
 * \`names.pt.ts\`, escrito a mao; o vocabulario de traducao esta em
 * \`taxonomy.ts\`. Metadados do projeto workout-guide de Bryl Lim, MIT.
 */

import type { ExerciseType, GuideEquipment, GuideMuscle } from './taxonomy';

/** \`[slug, primaryMuscle, equipment, exerciseType]\` */
export type MovementRow = readonly [string, GuideMuscle, GuideEquipment, ExerciseType];

export const MOVEMENT_DATA: readonly MovementRow[] = [
${rows.join('\n')}
];
`,
  );

  console.log(`${rows.length} movimentos em data.ts`);
}

await vendorData();
await vendorArt();

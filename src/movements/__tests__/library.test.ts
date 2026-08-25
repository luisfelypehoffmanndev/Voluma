import { COMMON_EXERCISES, MUSCLE_GROUPS, normalizeName } from '@/db/catalog';

import { FRAMES } from '../art';
import { MOVEMENT_DATA } from '../data';
import { NAMES_PT } from '../names.pt';
import { MOVEMENT_LIBRARY, artSlugFor, filterMovements, findMovement } from '../library';

/**
 * A biblioteca sao 288 nomes escritos a mao contra um manifesto gerado. Nada
 * neste arquivo testa logica interessante — o que ele faz e impedir que os dois
 * lados saiam de sincronia em silencio, que e o unico jeito de esta lista
 * quebrar.
 */

describe('nomes', () => {
  it('todo movimento do manifesto tem nome em portugues', () => {
    const semNome = MOVEMENT_DATA.map(([slug]) => slug).filter((slug) => !NAMES_PT[slug]);
    expect(semNome).toEqual([]);
  });

  it('nao ha nome em portugues sobrando', () => {
    const slugs = new Set(MOVEMENT_DATA.map(([slug]) => slug));
    expect(Object.keys(NAMES_PT).filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it('nenhum nome colide com outro depois de normalizado', () => {
    // Colisao aqui viraria dois movimentos disputando a mesma linha do catalogo,
    // porque `normalizeName` e a chave de deduplicacao do app inteiro.
    const vistos = new Map<string, string>();
    const duplicados: string[] = [];

    for (const movement of MOVEMENT_LIBRARY) {
      const chave = normalizeName(movement.name);
      const anterior = vistos.get(chave);
      if (anterior) duplicados.push(`${movement.name} == ${anterior}`);
      vistos.set(chave, movement.name);
    }

    expect(duplicados).toEqual([]);
  });
});

describe('sincronia com COMMON_EXERCISES', () => {
  it('todo movimento semeado existe na biblioteca', () => {
    const ausentes = COMMON_EXERCISES.filter((item) => !findMovement(item.name)).map(
      (item) => item.name,
    );
    expect(ausentes).toEqual([]);
  });

  it('todo movimento semeado tem figura', () => {
    // Se um comum perde a figura, meia lista do catalogo vira placeholder — o
    // caso que a vendorizacao existe para cobrir.
    const semArte = COMMON_EXERCISES.filter((item) => !artSlugFor(item.name)).map(
      (item) => item.name,
    );
    expect(semArte).toEqual([]);
  });

  it('nao ha figura vendorizada fora dos comuns e da corrida', () => {
    // O teto de peso do bundle e este: uma figura a mais que ninguem pediu passa
    // despercebida ate o app engordar. A corrida entra na lista por nao estar em
    // COMMON_EXERCISES (nasce em `ensureRunExercise`) e mesmo assim ser item
    // fixo do catalogo — sem ela, um dia de corrida nao teria figura nenhuma.
    const esperados = new Set(
      [
        ...COMMON_EXERCISES.map((item) => findMovement(item.name)?.slug),
        findMovement('Corrida')?.slug,
      ].filter(Boolean),
    );
    expect(Object.keys(FRAMES).filter((slug) => !esperados.has(slug))).toEqual([]);
  });

  it('a corrida tem figura', () => {
    expect(artSlugFor('Corrida')).toBe('running');
  });

  it('o grupo da biblioteca e o mesmo que o do catalogo semeado', () => {
    // Divergir faria o mesmo movimento aparecer em duas secoes da lista,
    // dependendo de ter vindo do seed ou da biblioteca.
    const divergentes = COMMON_EXERCISES.filter(
      (item) => findMovement(item.name)?.muscleGroup !== item.muscleGroup,
    ).map((item) => `${item.name}: ${item.muscleGroup} vs ${findMovement(item.name)?.muscleGroup}`);
    expect(divergentes).toEqual([]);
  });
});

describe('arte', () => {
  it('todo slug com figura existe na biblioteca', () => {
    const slugs = new Set(MOVEMENT_LIBRARY.map((movement) => movement.slug));
    expect(Object.keys(FRAMES).filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it('toda figura tem tres frames nao vazios', () => {
    for (const [slug, frames] of Object.entries(FRAMES)) {
      expect(frames).toHaveLength(3);
      for (const d of frames) expect(`${slug}: ${d.length > 0}`).toBe(`${slug}: true`);
    }
  });

  /**
   * A regressao que este bloco existe para pegar: uma versao anterior do
   * vendorizador arredondava com um regex de numero passado por cima da string
   * inteira. Como a notacao compacta de SVG encosta numeros sem separador
   * (`18.035.558` sao dois), arredondar o primeiro para `18` colava os dois num
   * `18.558` so — e as flags de arco viravam coordenada. O `react-native-svg`
   * reclamava de "invalid number format character" e a figura nao desenhava.
   */
  it('nenhum path tem numeros colados', () => {
    const colados = Object.entries(FRAMES).flatMap(([slug, frames]) =>
      frames.flatMap((d, i) => (/\d\.\d+\.\d/.test(d) ? [`${slug} frame ${i + 1}`] : [])),
    );
    expect(colados).toEqual([]);
  });

  it('nenhum path tem caractere fora da gramatica', () => {
    const invalidos = Object.entries(FRAMES).flatMap(([slug, frames]) =>
      frames.flatMap((d, i) => {
        const fora = [...new Set(d.replace(/[\d.\-+ ]/g, ''))].filter(
          (char) => !'MmLlHhVvCcSsQqTtAaZz'.includes(char),
        );
        return fora.length ? [`${slug} frame ${i + 1}: ${JSON.stringify(fora)}`] : [];
      }),
    );
    expect(invalidos).toEqual([]);
  });

  it('nenhum path usa notacao exponencial', () => {
    // `String(1e-7)` sai como "1e-7", que o parser de path recusa.
    const exp = Object.keys(FRAMES).filter((slug) =>
      FRAMES[slug].some((d) => /[eE]/.test(d)),
    );
    expect(exp).toEqual([]);
  });

  it('`illustrated` acompanha o que existe em FRAMES', () => {
    for (const movement of MOVEMENT_LIBRARY) {
      expect(movement.illustrated).toBe(movement.slug in FRAMES);
    }
  });
});

describe('taxonomia', () => {
  it('todo grupo e um dos nove do app', () => {
    const conhecidos = new Set<string>(MUSCLE_GROUPS);
    const fora = MOVEMENT_LIBRARY.filter(
      (movement) => !conhecidos.has(movement.muscleGroup),
    ).map((movement) => `${movement.slug}: ${movement.muscleGroup}`);
    expect(fora).toEqual([]);
  });

  it('`run` e Cardio sao a mesma coisa', () => {
    // A tela do dia e a de treino decidem por `kind`; a lista decide por grupo.
    // Se os dois discordarem, um movimento apareceria com steppers de carga
    // dentro da secao de cardio.
    const fora = MOVEMENT_LIBRARY.filter(
      (movement) => (movement.kind === 'run') !== (movement.muscleGroup === 'Cardio'),
    ).map((movement) => `${movement.slug}: ${movement.kind} / ${movement.muscleGroup}`);
    expect(fora).toEqual([]);
  });

  it('a corrida tem o nome que `ensureRunExercise` cria', () => {
    // Se divergir, a biblioteca ofereceria uma segunda corrida ao lado da que o
    // botao da tela do dia cria.
    expect(findMovement('Corrida')?.slug).toBe('running');
  });
});

describe('busca', () => {
  it('acha sem acento e sem caixa', () => {
    expect(findMovement('supino reto')?.slug).toBe('bench-press');
    expect(findMovement('BÍCEPS')).toBeNull();
    expect(filterMovements({ search: 'biceps' }).length).toBeGreaterThan(0);
  });

  it('filtra por grupo e equipamento juntos', () => {
    const resultado = filterMovements({ group: 'Pernas', equipment: 'Halteres' });
    expect(resultado.length).toBeGreaterThan(0);
    for (const movement of resultado) {
      expect(movement.muscleGroup).toBe('Pernas');
      expect(movement.equipment).toBe('Halteres');
    }
  });

  it('poe os ilustrados na frente', () => {
    const resultado = filterMovements({ group: 'Peito' });
    const primeiroSemArte = resultado.findIndex((movement) => !movement.illustrated);
    const ultimoComArte = resultado.map((m) => m.illustrated).lastIndexOf(true);
    expect(ultimoComArte).toBeLessThan(primeiroSemArte);
  });

  it('exercicio que nao esta na biblioteca nao tem figura', () => {
    expect(artSlugFor('Movimento que eu inventei')).toBeNull();
  });
});

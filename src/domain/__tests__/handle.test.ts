import { HANDLE_MAX, HANDLE_MIN, handleCandidates, isValidHandle, normalizeHandle } from '../handle';

describe('normalizeHandle', () => {
  it('baixa para minusculas', () => {
    expect(normalizeHandle('LuisFelype')).toBe('luisfelype');
  });

  it('corta espaco das pontas', () => {
    expect(normalizeHandle('  luis  ')).toBe('luis');
  });

  it('troca espaco do meio por ponto', () => {
    expect(normalizeHandle('Luis Felype')).toBe('luis.felype');
  });

  it('remove acento em vez de descartar a letra', () => {
    expect(normalizeHandle('Luís Felype')).toBe('luis.felype');
  });

  it('descarta o que nao pertence ao alfabeto do handle', () => {
    expect(normalizeHandle('luis@felype!')).toBe('luisfelype');
  });

  it('descarta o arroba — e adorno de exibicao, nao faz parte do dado', () => {
    expect(normalizeHandle('@luisfelype')).toBe('luisfelype');
  });

  it('nao produz pontos seguidos a partir de espacos seguidos', () => {
    expect(normalizeHandle('a  b')).toBe('a.b');
  });

  it('devolve vazio quando nao sobra nada do alfabeto latino', () => {
    expect(normalizeHandle('луис')).toBe('');
  });
});

describe('isValidHandle', () => {
  it('reprova abaixo do minimo', () => {
    expect(isValidHandle('lu')).toBe(false);
  });

  it('aprova um handle comum', () => {
    expect(isValidHandle('luis')).toBe(true);
  });

  it('aprova exatamente no teto — o limite e inclusivo', () => {
    expect(isValidHandle('a'.repeat(HANDLE_MAX))).toBe(true);
  });

  it('reprova um caractere acima do teto', () => {
    expect(isValidHandle('a'.repeat(HANDLE_MAX + 1))).toBe(false);
  });

  it('reprova maiuscula — espera receber ja normalizado', () => {
    expect(isValidHandle('Luis')).toBe(false);
  });

  it('reprova espaco', () => {
    expect(isValidHandle('luis felype')).toBe(false);
  });

  it('reprova vazio', () => {
    expect(isValidHandle('')).toBe(false);
  });
});

/**
 * As duas funcoes sao a mesma regra escrita duas vezes, e ainda uma terceira no
 * `check` do Postgres. Este teste e o que impede afrouxar uma sem a outra: sem
 * ele, a divergencia so apareceria como erro de constraint na cara de quem esta
 * tentando entrar.
 */
describe('normalizeHandle e isValidHandle concordam', () => {
  const entradas = [
    'LuisFelype',
    'Luís Felype',
    'luis@felype!',
    '@luisfelype',
    'a  b',
    'JOÃO.pedro',
    'maria_2026',
  ];

  it.each(entradas)('o que sai normalizado de %p e valido, se tiver tamanho', (entrada) => {
    const normalizado = normalizeHandle(entrada);
    if (normalizado.length < HANDLE_MIN || normalizado.length > HANDLE_MAX) return;
    expect(isValidHandle(normalizado)).toBe(true);
  });
});

describe('handleCandidates', () => {
  it('usa os dois primeiros nomes da conta Google', () => {
    const [primeiro] = handleCandidates('Luis Felype Hoffmann', 'x@gmail.com');
    expect(primeiro).toBe('luis.felype');
  });

  it('cai para a parte local do email quando nao ha nome', () => {
    const [primeiro] = handleCandidates('', 'luisfelype@gmail.com');
    expect(primeiro).toBe('luisfelype');
  });

  it('tem fallback valido quando nome e email nao rendem nada', () => {
    const [primeiro] = handleCandidates('', '');
    expect(isValidHandle(primeiro)).toBe(true);
  });

  it('tem fallback valido quando nada sobra da normalizacao', () => {
    const [primeiro] = handleCandidates('луис', 'луис@x.com');
    expect(isValidHandle(primeiro)).toBe(true);
  });

  it('nunca devolve candidato abaixo do minimo', () => {
    const [primeiro] = handleCandidates('Lu', 'lu@x.com');
    expect(primeiro.length).toBeGreaterThanOrEqual(HANDLE_MIN);
  });

  it('numera os candidatos seguintes a partir do primeiro', () => {
    const [primeiro, segundo, terceiro] = handleCandidates('Luis Felype', 'x@gmail.com');
    expect(segundo).toBe(`${primeiro}2`);
    expect(terceiro).toBe(`${primeiro}3`);
  });

  it('devolve mais de um candidato — colisao no primeiro login e esperada', () => {
    expect(handleCandidates('Luis Felype', 'x@gmail.com').length).toBeGreaterThan(1);
  });

  // A armadilha: truncar em 20 e so entao colar o sufixo produz 21 caracteres,
  // que o banco recusa — e recusa no primeiro login, o pior momento possivel.
  it('trunca o nome longo com espaco para o sufixo, nao depois dele', () => {
    const candidatos = handleCandidates('Maximiliano Bartolomeu de Albuquerque', 'x@gmail.com');
    for (const candidato of candidatos) {
      expect(isValidHandle(candidato)).toBe(true);
    }
  });

  it('todo candidato e valido, qualquer que seja a entrada', () => {
    const entradas: [string, string][] = [
      ['Luis Felype Hoffmann', 'luisfelype@gmail.com'],
      ['', ''],
      ['луис', 'x@y.com'],
      ['A', 'a@b.co'],
      ['Maximiliano Bartolomeu de Albuquerque', 'x@gmail.com'],
      ['....', '....@x.com'],
    ];

    for (const [nome, email] of entradas) {
      for (const candidato of handleCandidates(nome, email)) {
        expect(isValidHandle(candidato)).toBe(true);
      }
    }
  });
});

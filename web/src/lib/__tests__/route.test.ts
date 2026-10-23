import { describe, expect, it } from 'vitest';

import { hrefFor, parseRoute } from '../route';

const id = '9f0cc84b-c3b7-4abc-b919-df02d6a70cb3';

describe('rotas', () => {
  it('ida e volta entre rota e hash', () => {
    expect(parseRoute(hrefFor({ name: 'student', id }))).toEqual({ name: 'student', id });
    expect(parseRoute(hrefFor({ name: 'students' }))).toEqual({ name: 'students' });
  });

  it('hash desconhecido ou id invalido cai na lista', () => {
    expect(parseRoute('')).toEqual({ name: 'students' });
    expect(parseRoute('#/aluno/nao-e-uuid')).toEqual({ name: 'students' });
  });
});

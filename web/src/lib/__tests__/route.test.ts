import { describe, expect, it } from 'vitest';

import { hrefFor, parseRoute, type Route } from '../route';

const id = '9f0cc84b-c3b7-4abc-b919-df02d6a70cb3';

describe('rotas', () => {
  it('ida e volta entre rota e hash', () => {
    const routes: Route[] = [
      { name: 'students' },
      { name: 'student', id },
      { name: 'plans' },
      { name: 'plan', id },
      { name: 'plan', id: null },
    ];
    for (const route of routes) expect(parseRoute(hrefFor(route))).toEqual(route);
  });

  it('hash desconhecido ou id invalido cai na lista de alunos', () => {
    expect(parseRoute('')).toEqual({ name: 'students' });
    expect(parseRoute('#/aluno/nao-e-uuid')).toEqual({ name: 'students' });
    expect(parseRoute('#/plano/x')).toEqual({ name: 'students' });
  });
});

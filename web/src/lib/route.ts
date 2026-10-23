import { useEffect, useState } from 'react';

/** As rotas do painel, no hash: funciona em qualquer hospedagem estatica. */
export type Route =
  | { name: 'students' }
  | { name: 'student'; id: string }
  | { name: 'plans' }
  | { name: 'plan'; id: string | null };

const UUID = '([0-9a-f-]{36})';

export function parseRoute(hash: string): Route {
  let match = new RegExp(`^#/aluno/${UUID}$`).exec(hash);
  if (match) return { name: 'student', id: match[1] };
  if (hash === '#/planos') return { name: 'plans' };
  if (hash === '#/plano/novo') return { name: 'plan', id: null };
  match = new RegExp(`^#/plano/${UUID}$`).exec(hash);
  if (match) return { name: 'plan', id: match[1] };
  return { name: 'students' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'student':
      return `#/aluno/${route.id}`;
    case 'plans':
      return '#/planos';
    case 'plan':
      return route.id ? `#/plano/${route.id}` : '#/plano/novo';
    default:
      return '#/alunos';
  }
}

export function go(route: Route) {
  window.location.hash = hrefFor(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

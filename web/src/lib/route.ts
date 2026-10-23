import { useEffect, useState } from 'react';

/** As rotas do painel, no hash: funciona em qualquer hospedagem estatica. */
export type Route = { name: 'students' } | { name: 'student'; id: string };

export function parseRoute(hash: string): Route {
  const match = /^#\/aluno\/([0-9a-f-]{36})$/.exec(hash);
  if (match) return { name: 'student', id: match[1] };
  return { name: 'students' };
}

export function hrefFor(route: Route): string {
  return route.name === 'student' ? `#/aluno/${route.id}` : '#/alunos';
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

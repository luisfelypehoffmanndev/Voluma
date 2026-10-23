import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string };

function fromSession(session: Session | null): SessionState {
  if (!session) return { status: 'signedOut' };
  return { status: 'signedIn', userId: session.user.id, email: session.user.email ?? '' };
}

/** A sessao do Supabase, ja resolvida do redirect do Google quando ha um. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setState(fromSession(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(fromSession(session));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function signInWithGoogle(): Promise<unknown> {
  // Volta para a mesma pagina. A URL precisa estar nas Redirect URLs do
  // Supabase Auth; sem ela, o Supabase manda para a Site URL (o app).
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export function signOut(): Promise<unknown> {
  return supabase.auth.signOut();
}

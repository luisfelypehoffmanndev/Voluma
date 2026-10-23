import { useEffect, useState } from 'react';

import { loadMemberships, type Membership } from './lib/data';
import { gymConfig } from './lib/gyms';
import { useRoute } from './lib/route';
import { signOut, useSession } from './lib/session';
import { GymPicker } from './screens/GymPicker';
import { Login } from './screens/Login';
import { Plan } from './screens/Plan';
import { Plans } from './screens/Plans';
import { Message } from './screens/Message';
import { Student } from './screens/Student';
import { Students } from './screens/Students';

const GYM_KEY = 'voluma.painel.gym';

function readSavedGym(): string | null {
  try {
    return localStorage.getItem(GYM_KEY);
  } catch {
    return null;
  }
}

function saveGym(gym: string | null) {
  try {
    if (gym) localStorage.setItem(GYM_KEY, gym);
    else localStorage.removeItem(GYM_KEY);
  } catch {
    // Sem storage (aba anonima): escolhe de novo a cada visita.
  }
}

type Access =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; memberships: Membership[] };

export function App() {
  const session = useSession();
  const route = useRoute();
  const [access, setAccess] = useState<Access>({ status: 'loading' });
  const [gym, setGym] = useState<string | null>(readSavedGym);
  const [attempt, setAttempt] = useState(0);

  const userId = session.status === 'signedIn' ? session.userId : null;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setAccess({ status: 'loading' });
    loadMemberships()
      .then((memberships) => alive && setAccess({ status: 'ready', memberships }))
      .catch((error: Error) => alive && setAccess({ status: 'error', message: error.message }));
    return () => {
      alive = false;
    };
  }, [userId, attempt]);

  if (session.status === 'loading') return <Message title="Abrindo o painel" />;
  if (session.status === 'signedOut') return <Login />;

  if (access.status === 'loading') return <Message title="Conferindo seu acesso" />;
  if (access.status === 'error') {
    return (
      <Message
        title="Não deu para conferir seu acesso"
        detail={access.message}
        action={{ label: 'Tentar de novo', onClick: () => setAttempt((n) => n + 1) }}
      />
    );
  }

  const { memberships } = access;
  if (memberships.length === 0) {
    return (
      <Message
        title="Esta conta não é da equipe de nenhuma academia"
        detail={`Peça ao admin da sua academia um convite para ${session.email}. Depois é só entrar de novo.`}
        action={{ label: 'Sair', onClick: () => void signOut() }}
      />
    );
  }

  const current = memberships.find((m) => m.gym_id === gym) ?? (memberships.length === 1 ? memberships[0] : null);
  if (!current) {
    return (
      <GymPicker
        memberships={memberships}
        onPick={(picked) => {
          saveGym(picked);
          setGym(picked);
        }}
      />
    );
  }

  const config = gymConfig(current.gym_id);
  return (
    <div className="shell" style={{ ['--accent' as string]: config.accent }}>
      <header className="topbar">
        <a className="brand" href="#/alunos">
          {config.name}
        </a>
        <nav className="nav">
          <a href="#/alunos" aria-current={route.name === 'students' || route.name === 'student' ? 'page' : undefined}>
            Alunos
          </a>
          <a href="#/planos" aria-current={route.name === 'plans' || route.name === 'plan' ? 'page' : undefined}>
            Planos
          </a>
        </nav>
        <div className="account">
          <span className="muted">
            {session.email} · {current.role === 'admin' ? 'admin' : 'instrutor'}
          </span>
          {memberships.length > 1 ? (
            <button
              className="link"
              onClick={() => {
                saveGym(null);
                setGym(null);
              }}
            >
              Trocar academia
            </button>
          ) : null}
          <button className="link" onClick={() => void signOut()}>
            Sair
          </button>
        </div>
      </header>
      <main className="content">
        {route.name === 'student' ? <Student gym={current.gym_id} studentId={route.id} /> : null}
        {route.name === 'students' ? <Students gym={current.gym_id} /> : null}
        {route.name === 'plans' ? <Plans gym={current.gym_id} /> : null}
        {route.name === 'plan' ? <Plan key={route.id ?? 'novo'} gym={current.gym_id} planId={route.id} /> : null}
      </main>
    </div>
  );
}

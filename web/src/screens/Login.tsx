import { useState } from 'react';

import { signInWithGoogle } from '../lib/session';

export function Login() {
  const [busy, setBusy] = useState(false);
  return (
    <main className="center">
      <div className="center-box">
        <p className="wordmark">Voluma</p>
        <h1 className="title">Painel da academia</h1>
        <p className="muted">
          Para a equipe acompanhar os alunos e montar o treino deles. Entre com a conta Google que recebeu o convite.
        </p>
        <button
          className="button button-accent"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signInWithGoogle().finally(() => setBusy(false));
          }}
        >
          {busy ? 'Abrindo o Google…' : 'Entrar com Google'}
        </button>
      </div>
    </main>
  );
}

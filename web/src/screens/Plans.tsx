import { useEffect, useState } from 'react';

import { loadPlans, loadWorkouts, type Plan, type Workout } from '../lib/data';
import { weekSummary } from '../lib/plans';
import { hrefFor } from '../lib/route';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; plans: Plan[]; workouts: Workout[] };

export function Plans({ gym }: { gym: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    Promise.all([loadPlans(gym), loadWorkouts(gym)])
      .then(([plans, workouts]) => alive && setLoad({ status: 'ready', plans, workouts }))
      .catch((error: Error) => alive && setLoad({ status: 'error', message: error.message }));
    return () => {
      alive = false;
    };
  }, [gym, attempt]);

  return (
    <section>
      <div className="page-head page-head-row">
        <div>
          <h1 className="title">Planos</h1>
          <p className="muted">Um programa da semana: cada dia com um treino. Quem entra no plano recebe as mudanças dele.</p>
        </div>
        <a className="button button-accent" href={hrefFor({ name: 'plan', id: null })}>
          Novo plano
        </a>
      </div>

      {load.status === 'loading' ? <p className="muted pad">Carregando planos</p> : null}
      {load.status === 'error' ? (
        <div className="pad">
          <p>Não deu para carregar os planos: {load.message}</p>
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      {load.status === 'ready' && load.plans.length === 0 ? (
        <div className="pad">
          <p>Ainda não há planos nesta academia.</p>
          <p className="muted">Crie um plano, escolha o treino de cada dia e depois adicione os alunos.</p>
        </div>
      ) : null}
      {load.status === 'ready' && load.plans.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>Plano</th>
              <th>Semana</th>
              <th>No app</th>
            </tr>
          </thead>
          <tbody>
            {load.plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <a className="row-link" href={hrefFor({ name: 'plan', id: plan.id })}>
                    {plan.name}
                  </a>
                </td>
                <td className="muted">
                  {weekSummary(plan.days, (id) => load.workouts.find((w) => w.id === id)?.name ?? 'treino apagado')}
                </td>
                <td>{plan.open_to_students ? 'Aberto para escolher' : 'Só a equipe atribui'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

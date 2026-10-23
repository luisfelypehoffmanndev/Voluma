import type { Weekday } from '@domain/types';
import { weekdayName } from '@domain/week';
import { useCallback, useEffect, useState } from 'react';

import { AssignPanel } from '../components/AssignPanel';
import { ExerciseList, type ExerciseDraft } from '../components/ExerciseList';
import {
  deletePlan,
  loadPlanMembers,
  loadPlans,
  loadWorkouts,
  removeFromPlan,
  savePlan,
  saveWorkout,
  type PlanMemberRow,
  type Workout,
} from '../lib/data';
import { memberStatus } from '../lib/plans';
import { go, hrefFor } from '../lib/route';
import { studentName } from '../lib/students';

const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

type Draft = { name: string; open: boolean; days: Record<number, string> };

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; workouts: Workout[]; members: PlanMemberRow[] };

export function Plan({ gym, planId }: { gym: string; planId: string | null }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [draft, setDraft] = useState<Draft>({ name: '', open: false, days: {} });
  const [saved, setSaved] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; name: string; exercises: ExerciseDraft[] } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    // Recarregar (depois de salvar ou aplicar) troca os dados sem tirar a tela:
    // voltar ao "Carregando" desmontaria o painel de atribuicao no meio do fluxo.
    setLoad((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    Promise.all([loadWorkouts(gym), planId ? loadPlans(gym) : Promise.resolve([]), planId ? loadPlanMembers(gym, planId) : Promise.resolve([])])
      .then(([workouts, plans, members]) => {
        if (!alive) return;
        if (planId) {
          const plan = plans.find((p) => p.id === planId);
          if (!plan) throw new Error('Este plano não existe mais ou não é desta academia.');
          const next: Draft = {
            name: plan.name,
            open: plan.open_to_students,
            days: Object.fromEntries(plan.days.map((d) => [d.weekday, d.preset_id])),
          };
          setDraft(next);
          setSaved(next);
        }
        setLoad({ status: 'ready', workouts, members });
      })
      .catch((e: Error) => alive && setLoad({ status: 'error', message: e.message }));
    return () => {
      alive = false;
    };
  }, [gym, planId, attempt]);

  if (load.status === 'loading') return <p className="muted pad">Carregando o plano</p>;
  if (load.status === 'error') {
    return (
      <div className="pad">
        <p>{load.message}</p>
        <a className="button" href={hrefFor({ name: 'plans' })}>
          Voltar para os planos
        </a>
      </div>
    );
  }

  const { workouts, members } = load;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const canSave = draft.name.trim() !== '' && (dirty || !planId);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await savePlan(gym, {
        id: planId ?? undefined,
        name: draft.name.trim(),
        open_to_students: draft.open,
        days: Object.entries(draft.days)
          .filter(([, preset]) => preset)
          .map(([weekday, preset_id]) => ({ weekday: Number(weekday), preset_id })),
      });
      if (!planId) {
        go({ name: 'plan', id: result.plan_id });
        return;
      }
      setNotice(
        result.students_updated || result.skipped
          ? `Plano salvo. ${result.students_updated} ${result.students_updated === 1 ? 'dia de aluno mudou' : 'dias de alunos mudaram'}` +
              (result.skipped ? `; ${result.skipped} ${result.skipped === 1 ? 'aluno já tinha' : 'alunos já tinham'} treino no dia novo e ficou como estava.` : '.')
          : 'Plano salvo.',
      );
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!planId || !window.confirm(`Apagar o plano "${draft.name}"? Os alunos continuam com os treinos que têm.`)) return;
    setBusy(true);
    try {
      await deletePlan(gym, planId);
      go({ name: 'plans' });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const saveEditing = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await saveWorkout(gym, {
        id: editing.id,
        name: editing.name.trim(),
        exercises: editing.exercises.map((e) => ({
          id: e.ref,
          movement_slug: e.movementSlug,
          name: e.name,
          muscle_group: e.muscleGroup,
          kind: e.kind,
          sets: e.sets,
          reps: e.reps,
          distance_km: e.distanceKm,
          duration_min: e.durationMin,
        })),
      });
      setNotice(editing.id ? 'Treino salvo. Quem segue o plano recebe as mudanças, menos nas exceções de cada aluno.' : 'Treino criado.');
      setEditing(null);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const usedIds = new Set(Object.values(draft.days).filter(Boolean));

  return (
    <section>
      <a className="back" href={hrefFor({ name: 'plans' })}>
        Planos
      </a>
      <div className="page-head page-head-row">
        <label className="title-input">
          <span className="sr-only">Nome do plano</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Nome do plano"
            maxLength={60}
          />
        </label>
        <div className="head-actions">
          {planId ? (
            <button className="link" onClick={() => void remove()} disabled={busy}>
              Apagar plano
            </button>
          ) : null}
          {planId ? (
            <button
              className="button"
              onClick={() => setAssigning(true)}
              disabled={dirty || busy}
              title={dirty ? 'Salve o plano antes' : undefined}
            >
              Adicionar alunos
            </button>
          ) : null}
          <button className="button button-accent" onClick={() => void save()} disabled={!canSave || busy}>
            {planId ? 'Salvar plano' : 'Criar plano'}
          </button>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <div className="panel">
        <h2>Semana</h2>
        <p className="muted">Escolha o treino de cada dia. Dia sem treino é descanso.</p>
        <div className="week-picker">
          {WEEK.map((weekday) => (
            <label key={weekday} className="field">
              <span>{weekdayName(weekday)}</span>
              <select
                value={draft.days[weekday] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, days: { ...d.days, [weekday]: e.target.value } }))}
              >
                <option value="">Descanso</option>
                {workouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={draft.open} onChange={(e) => setDraft((d) => ({ ...d, open: e.target.checked }))} />
          Aberto: os alunos podem escolher este plano no app
        </label>
      </div>

      {planId ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Alunos</h2>
            <button className="button" onClick={() => setAssigning(true)} disabled={dirty}>
              Adicionar alunos
            </button>
          </div>
          {dirty ? <p className="muted">Salve o plano antes de adicionar alunos.</p> : null}
          {members.length === 0 ? (
            <p className="muted">
              Ninguém segue este plano ainda. Use “Adicionar alunos”, ou marque os alunos na tela Alunos e escolha “Pôr no plano”.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Como está</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td>
                      <a className="row-link" href={hrefFor({ name: 'student', id: m.user_id })}>
                        {studentName(m)}
                      </a>
                    </td>
                    <td>{memberStatus(m)}</td>
                    <td className="right">
                      <button
                        className="link"
                        onClick={async () => {
                          if (!window.confirm(`Tirar ${studentName(m)} do plano? Os treinos ficam com ele, como prescritos.`)) return;
                          try {
                            await removeFromPlan(gym, planId, [m.user_id]);
                            reload();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Tirar do plano
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <h2>Treinos</h2>
          <button className="button" onClick={() => setEditing({ name: '', exercises: [] })} disabled={busy}>
            Novo treino
          </button>
        </div>
        {workouts.length === 0 ? <p className="muted">Crie o primeiro treino para usar na semana.</p> : null}
        <ul className="workouts">
          {workouts.map((w) => (
            <li key={w.id}>
              <button
                className="workout-item"
                onClick={() =>
                  setEditing({
                    id: w.id,
                    name: w.name,
                    exercises: w.exercises.map((e) => ({
                      key: e.id,
                      ref: e.id,
                      movementSlug: e.movement_slug,
                      name: e.name,
                      muscleGroup: e.muscle_group,
                      kind: e.kind,
                      sets: e.sets,
                      reps: e.reps,
                      distanceKm: e.distance_km,
                      durationMin: e.duration_min,
                    })),
                  })
                }
              >
                <span>{w.name}</span>
                <span className="muted">
                  {w.exercises.length} {w.exercises.length === 1 ? 'exercício' : 'exercícios'}
                  {usedIds.has(w.id) ? ' · neste plano' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {editing ? (
          <div className="editor">
            <label className="field">
              <span>Nome do treino</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60} />
            </label>
            <ExerciseList value={editing.exercises} onChange={(exercises) => setEditing({ ...editing, exercises })} />
            <div className="editor-actions">
              <button className="link" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="button" onClick={() => void saveEditing()} disabled={busy || !editing.name.trim()}>
                {editing.id ? 'Salvar treino' : 'Criar treino'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {assigning && planId ? (
        <AssignPanel gym={gym} plan={planId} planName={draft.name} onClose={() => setAssigning(false)} onApplied={reload} />
      ) : null}
    </section>
  );
}

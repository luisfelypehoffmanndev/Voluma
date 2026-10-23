import type { Weekday } from '@domain/types';
import { weekdayName, weekdayOf, weekPlan } from '@domain/week';
import { useEffect, useState } from 'react';

import { ExerciseList, type ExerciseDraft } from '../components/ExerciseList';
import {
  customizeDay,
  DEFAULT_FILTERS,
  loadPlans,
  loadPresetNames,
  loadStudents,
  loadWeek,
  resetDay,
  setDay,
  type PlanDay,
} from '../lib/data';
import { hrefFor } from '../lib/route';
import { DAY_LINK_LABEL, dayLink, studentName, type StudentRow } from '../lib/students';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      student: StudentRow | null;
      days: PlanDay[];
      presets: Map<string, string>;
      plans: Map<string, string>;
    };

type Editing = { weekday: Weekday; day: PlanDay | null; name: string; exercises: ExerciseDraft[] };

export function Student({ gym, studentId }: { gym: string; studentId: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    Promise.all([
      loadStudents(gym, DEFAULT_FILTERS, new Date()),
      loadWeek(gym, studentId),
      loadPresetNames(gym),
      loadPlans(gym),
    ])
      .then(([students, days, presets, plans]) => {
        if (!alive) return;
        const student = students.find((s) => s.user_id === studentId) ?? null;
        setLoad({ status: 'ready', student, days, presets, plans: new Map(plans.map((p) => [p.id, p.name])) });
      })
      .catch((e: Error) => alive && setLoad({ status: 'error', message: e.message }));
    return () => {
      alive = false;
    };
  }, [gym, studentId, attempt]);

  if (load.status === 'loading') return <p className="muted pad">Carregando a semana</p>;
  if (load.status === 'error') {
    return (
      <div className="pad">
        <p>Não deu para carregar a semana: {load.message}</p>
        <button className="button" onClick={() => setAttempt((n) => n + 1)}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const { student, days, presets, plans } = load;
  if (!student) {
    return (
      <div className="pad">
        <p>Este aluno não é desta academia.</p>
        <a className="button" href={hrefFor({ name: 'students' })}>
          Voltar para os alunos
        </a>
      </div>
    );
  }

  const plan = weekPlan(days) as (PlanDay | null)[];
  const today = weekdayOf(new Date());

  const open = (weekday: Weekday, day: PlanDay | null) => {
    setError(null);
    setEditing({
      weekday,
      day,
      name: day?.name ?? '',
      exercises: (day?.exercises ?? []).map((e) => ({
        key: e.id,
        ref: e.id,
        movementSlug: '',
        name: e.name,
        muscleGroup: null,
        kind: e.kind,
        sets: e.sets,
        reps: e.reps,
        distanceKm: e.distanceKm,
        durationMin: e.durationMin,
        exception: e.exception,
      })),
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const items = editing.exercises.map((e) => ({
      routine_exercise_id: e.ref,
      name: e.name,
      muscle_group: e.muscleGroup,
      kind: e.kind,
      sets: e.sets,
      reps: e.reps,
      distance_km: e.distanceKm,
      duration_min: e.durationMin,
    }));
    try {
      // Dia que segue um treino (plano ou ficha) ganha excecoes e continua no
      // plano; o resto e substituido e fica prescrito.
      if (editing.day?.presetId) {
        await customizeDay(gym, studentId, editing.weekday, items, editing.day.updatedAt);
      } else {
        await setDay(gym, studentId, editing.weekday, editing.name.trim() || weekdayName(editing.weekday), items, editing.day?.updatedAt ?? null);
      }
      setEditing(null);
      setAttempt((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (weekday: Weekday) => {
    if (!window.confirm('Voltar este dia ao treino do plano? As mudanças feitas só para este aluno saem.')) return;
    setBusy(true);
    try {
      await resetDay(gym, studentId, weekday);
      setAttempt((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <a className="back" href={hrefFor({ name: 'students' })}>
        Alunos
      </a>
      <div className="page-head">
        <h1 className="title">{studentName(student)}</h1>
        <p className="muted">
          {student.handle && student.display_name ? `@${student.handle} · ` : ''}
          <span className="num">{student.trained_days}</span> {student.trained_days === 1 ? 'dia treinado' : 'dias treinados'} nas
          últimas 4 semanas
        </p>
      </div>
      {error && !editing ? <p className="error">{error}</p> : null}

      <div className="week">
        {plan.map((day, weekday) => {
          const hasWorkout = Boolean(day && day.exercises.length > 0);
          const exceptions = day?.exercises.some((e) => e.exception) ?? false;
          return (
            <article key={weekday} className={weekday === today ? 'day day-today' : 'day'}>
              <header className="day-head">
                <h2>{weekdayName(weekday as Weekday)}</h2>
                {weekday === today ? <span className="today">hoje</span> : null}
              </header>
              {day && hasWorkout ? (
                <>
                  <p className="day-name">{day.name || 'Sem nome'}</p>
                  <p className={`badge badge-${dayLink(dayInput(day))}`}>{linkLabel(day, presets, plans)}</p>
                  {exceptions ? <p className="badge">Com exceções só deste aluno</p> : null}
                  <ul className="exercises">
                    {day.exercises.map((exercise) => (
                      <li key={exercise.id}>
                        <span>
                          {exercise.name}
                          {exercise.exception ? <span className="muted"> *</span> : null}
                        </span>
                        <span className="num">
                          {exercise.kind === 'run' ? `${exercise.distanceKm} km` : `${exercise.sets}×${exercise.reps}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">Descanso</p>
              )}
              <div className="day-actions">
                <button className="link" onClick={() => open(weekday as Weekday, day)} disabled={busy}>
                  {hasWorkout ? (day?.presetId ? 'Personalizar' : 'Editar') : 'Montar dia'}
                </button>
                {day?.presetId && exceptions ? (
                  <button className="link" onClick={() => void reset(weekday as Weekday)} disabled={busy}>
                    Voltar ao plano
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {editing ? (
        <div className="sheet" role="dialog" aria-label={`Editar ${weekdayName(editing.weekday)}`}>
          <div className="sheet-head">
            <h2>
              {weekdayName(editing.weekday)} de {studentName(student)}
            </h2>
            <button className="link" onClick={() => setEditing(null)}>
              Fechar
            </button>
          </div>
          {editing.day?.presetId ? (
            <p className="muted">
              Este dia segue {linkLabel(editing.day, presets, plans).toLowerCase()}. O que você mudar aqui vale só para este aluno,
              e ele continua recebendo as outras mudanças do treino.
            </p>
          ) : (
            <label className="field">
              <span>Nome do dia</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60} />
            </label>
          )}
          {error ? <p className="error">{error}</p> : null}
          <ExerciseList value={editing.exercises} onChange={(exercises) => setEditing({ ...editing, exercises })} />
          <div className="sheet-foot">
            <button className="link" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className="button button-accent" onClick={() => void save()} disabled={busy}>
              Salvar dia
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function linkLabel(day: PlanDay, presets: Map<string, string>, plans: Map<string, string>): string {
  if (day.planId && day.presetId && plans.has(day.planId)) return `Plano ${plans.get(day.planId)}`;
  if (day.presetId && presets.has(day.presetId)) return `Ficha ${presets.get(day.presetId)}`;
  return DAY_LINK_LABEL[dayLink(dayInput(day))];
}

function dayInput(day: PlanDay) {
  return { preset_id: day.presetId ?? null, prescribed_by: day.prescribedBy ?? null, prescribed_at: day.prescribedAt };
}

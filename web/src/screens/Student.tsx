import type { Weekday } from '@domain/types';
import { weekdayName, weekdayOf, weekPlan } from '@domain/week';
import { useEffect, useState } from 'react';

import { loadPresetNames, loadStudents, loadWeek, DEFAULT_FILTERS, type PlanDay } from '../lib/data';
import { hrefFor } from '../lib/route';
import { DAY_LINK_LABEL, dayLink, studentName, type StudentRow } from '../lib/students';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; student: StudentRow | null; days: PlanDay[]; presets: Map<string, string> };

export function Student({ gym, studentId }: { gym: string; studentId: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    Promise.all([loadStudents(gym, DEFAULT_FILTERS, new Date()), loadWeek(gym, studentId), loadPresetNames(gym)])
      .then(([students, days, presets]) => {
        if (!alive) return;
        const student = students.find((s) => s.user_id === studentId) ?? null;
        setLoad({ status: 'ready', student, days, presets });
      })
      .catch((error: Error) => alive && setLoad({ status: 'error', message: error.message }));
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

  const { student, days, presets } = load;
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

  return (
    <section>
      <a className="back" href={hrefFor({ name: 'students' })}>
        Alunos
      </a>
      <div className="page-head">
        <h1 className="title">{studentName(student)}</h1>
        <p className="muted">
          {student.handle && student.display_name ? `@${student.handle} · ` : ''}
          <span className="num">{student.trained_days}</span> {student.trained_days === 1 ? 'dia treinado' : 'dias treinados'}{' '}
          nas últimas 4 semanas
        </p>
      </div>

      <div className="week">
        {plan.map((day, weekday) => (
          <article key={weekday} className={weekday === today ? 'day day-today' : 'day'}>
            <header className="day-head">
              <h2>{weekdayName(weekday as Weekday)}</h2>
              {weekday === today ? <span className="today">hoje</span> : null}
            </header>
            {day && day.exercises.length > 0 ? (
              <>
                <p className="day-name">{day.name || 'Sem nome'}</p>
                <p className={`badge badge-${dayLink(dayInput(day))}`}>
                  {day.presetId && presets.has(day.presetId)
                    ? `Ficha: ${presets.get(day.presetId)}`
                    : DAY_LINK_LABEL[dayLink(dayInput(day))]}
                </p>
                <ul className="exercises">
                  {day.exercises.map((exercise) => (
                    <li key={exercise.id}>
                      <span>{exercise.name}</span>
                      <span className="num">
                        {exercise.kind === 'run'
                          ? `${exercise.distanceKm} km`
                          : `${exercise.sets}×${exercise.reps}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Descanso</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function dayInput(day: PlanDay) {
  return { preset_id: day.presetId ?? null, prescribed_by: day.prescribedBy ?? null, prescribed_at: day.prescribedAt };
}

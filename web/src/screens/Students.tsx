import { toDateKey } from '@domain/week';
import { useEffect, useMemo, useState } from 'react';

import { AssignPanel } from '../components/AssignPanel';
import { DEFAULT_FILTERS, loadPlans, loadStudents, type Plan, type StudentFilters } from '../lib/data';
import { hrefFor } from '../lib/route';
import { lastTrainedLabel, matchesSearch, studentName, type StudentRow } from '../lib/students';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: StudentRow[] };

const WEEKS = [2, 4, 8, 12];
const INACTIVE = [null, 7, 14, 30] as const;

export function Students({ gym }: { gym: string }) {
  const [filters, setFilters] = useState<StudentFilters>(DEFAULT_FILTERS);
  const [exerciseDraft, setExerciseDraft] = useState('');
  const [search, setSearch] = useState('');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [targetPlan, setTargetPlan] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadPlans(gym)
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [gym]);

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    loadStudents(gym, filters, new Date())
      .then((rows) => alive && setLoad({ status: 'ready', rows }))
      .catch((error: Error) => alive && setLoad({ status: 'error', message: error.message }));
    return () => {
      alive = false;
    };
  }, [gym, filters, attempt]);

  const rows = useMemo(
    () => (load.status === 'ready' ? load.rows.filter((row) => matchesSearch(row, search)) : []),
    [load, search],
  );
  const today = toDateKey(new Date());
  const filtered =
    search.trim() !== '' ||
    filters.prescribedOnly ||
    filters.inactiveDays !== null ||
    filters.hasExercise.trim() !== '';

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  const allVisible = rows.length > 0 && rows.every((r) => selected.has(r.user_id));
  const chosenRows = load.status === 'ready' ? load.rows.filter((r) => selected.has(r.user_id)) : [];
  const plan = plans.find((p) => p.id === targetPlan);

  const clear = () => {
    setSearch('');
    setExerciseDraft('');
    setFilters({ ...DEFAULT_FILTERS, weeks: filters.weeks });
  };

  return (
    <section>
      <div className="page-head">
        <h1 className="title">Alunos</h1>
        {load.status === 'ready' ? (
          <p className="muted">
            <span className="num">{rows.length}</span> {rows.length === 1 ? 'aluno' : 'alunos'}
            {rows.length !== load.rows.length ? ` de ${load.rows.length}` : ''}
          </p>
        ) : null}
      </div>

      <div className="filters" role="search">
        <label className="field field-grow">
          <span>Nome ou @</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" />
        </label>
        <label className="field">
          <span>Tem no plano</span>
          <input
            value={exerciseDraft}
            onChange={(e) => setExerciseDraft(e.target.value)}
            onBlur={() => setFilters((f) => ({ ...f, hasExercise: exerciseDraft }))}
            onKeyDown={(e) => e.key === 'Enter' && setFilters((f) => ({ ...f, hasExercise: exerciseDraft }))}
            placeholder="Exercício"
          />
        </label>
        <label className="field">
          <span>Frequência em</span>
          <select value={filters.weeks} onChange={(e) => setFilters((f) => ({ ...f, weeks: Number(e.target.value) }))}>
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                {w} semanas
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Sem treinar há</span>
          <select
            value={filters.inactiveDays ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, inactiveDays: e.target.value ? Number(e.target.value) : null }))}
          >
            {INACTIVE.map((d) => (
              <option key={d ?? 'all'} value={d ?? ''}>
                {d ? `${d} dias ou mais` : 'qualquer'}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.prescribedOnly}
            onChange={(e) => setFilters((f) => ({ ...f, prescribedOnly: e.target.checked }))}
          />
          Só com dias prescritos
        </label>
      </div>

      {load.status === 'loading' ? <p className="muted pad">Carregando alunos</p> : null}
      {load.status === 'error' ? (
        <div className="pad">
          <p>Não deu para carregar os alunos: {load.message}</p>
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      {load.status === 'ready' && rows.length === 0 ? (
        <div className="pad">
          <p>{filtered ? 'Nenhum aluno com esses filtros.' : 'Ainda não há alunos nesta academia.'}</p>
          {filtered ? (
            <button className="button" onClick={clear}>
              Limpar filtros
            </button>
          ) : (
            <p className="muted">Aparece aqui quem entrar com a conta no app da academia.</p>
          )}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th className="check-col">
                <input
                  type="checkbox"
                  aria-label="Marcar todos da lista"
                  checked={allVisible}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.user_id)) : new Set())}
                />
              </th>
              <th>Aluno</th>
              <th className="right">Treinou</th>
              <th>Último treino</th>
              <th className="right">Dias no plano</th>
              <th className="right">Prescritos</th>
              <th className="right">Editados pelo aluno</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id}>
                <td className="check-col">
                  <input
                    type="checkbox"
                    aria-label={`Marcar ${studentName(row)}`}
                    checked={selected.has(row.user_id)}
                    onChange={(e) => toggle(row.user_id, e.target.checked)}
                  />
                </td>
                <td>
                  <a className="row-link" href={hrefFor({ name: 'student', id: row.user_id })}>
                    {studentName(row)}
                  </a>
                  {row.handle && row.display_name ? <span className="muted"> @{row.handle}</span> : null}
                </td>
                <td className="right">
                  <span className="num">{row.trained_days}</span>
                  <span className="muted"> {row.trained_days === 1 ? 'dia' : 'dias'}</span>
                </td>
                <td>{lastTrainedLabel(row.last_trained_on, today)}</td>
                <td className="right num">{row.planned_days}</td>
                <td className="right num">{row.prescribed_days}</td>
                <td className="right num">{row.self_edited_days || <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {selected.size > 0 ? (
        <div className="action-bar" role="region" aria-label="Alunos marcados">
          <span>
            <span className="num">{selected.size}</span> {selected.size === 1 ? 'aluno marcado' : 'alunos marcados'}
          </span>
          {plans.length > 0 ? (
            <>
              <label className="field">
                <span className="sr-only">Plano</span>
                <select value={targetPlan} onChange={(e) => setTargetPlan(e.target.value)}>
                  <option value="">Escolha um plano</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button-accent" disabled={!plan} onClick={() => setAssigning(true)}>
                Pôr no plano
              </button>
            </>
          ) : (
            <a className="link" href={hrefFor({ name: 'plan', id: null })}>
              Crie um plano para pôr os alunos nele
            </a>
          )}
          <button className="link" onClick={() => setSelected(new Set())}>
            Desmarcar
          </button>
        </div>
      ) : null}

      {assigning && plan ? (
        <AssignPanel
          gym={gym}
          plan={plan.id}
          planName={plan.name}
          preselected={chosenRows}
          onClose={() => setAssigning(false)}
          onApplied={() => {
            setSelected(new Set());
            setAttempt((n) => n + 1);
          }}
        />
      ) : null}
    </section>
  );
}

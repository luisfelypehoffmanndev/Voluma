import { useMemo, useState } from 'react';

import { assignPlan, DEFAULT_FILTERS, loadStudents, type AssignRow, type StudentFilters } from '../lib/data';
import { buildReplace, countToApply, CURRENT_LABEL, isConflict, pairKey, shortDay } from '../lib/plans';
import { matchesSearch, studentName, type StudentRow } from '../lib/students';

type Step =
  | { name: 'pick' }
  | { name: 'loading' }
  | { name: 'preview'; rows: AssignRow[] }
  | { name: 'applying' }
  | { name: 'done'; applied: number; skipped: number };

/**
 * Adicionar alunos ao plano: filtra, marca, ve a previa por aluno e dia e
 * aplica exatamente o que a previa mostrou.
 */
export function AssignPanel({ gym, plan, onClose, onApplied }: { gym: string; plan: string; onClose: () => void; onApplied: () => void }) {
  const [filters, setFilters] = useState<StudentFilters & { onlyWithoutPlan: boolean }>({ ...DEFAULT_FILTERS, onlyWithoutPlan: false });
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>({ name: 'pick' });
  const [error, setError] = useState<string | null>(null);

  const search_ = async () => {
    setError(null);
    try {
      const rows = await loadStudents(gym, filters, new Date(), { noPlan: filters.onlyWithoutPlan });
      setStudents(rows.filter((r) => !r.plan_ids?.includes(plan)));
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const visible = useMemo(() => (students ?? []).filter((s) => matchesSearch(s, search)), [students, search]);
  const names = useMemo(() => new Map((students ?? []).map((s) => [s.user_id, studentName(s)])), [students]);

  const preview = async () => {
    setError(null);
    setStep({ name: 'loading' });
    try {
      const rows = await assignPlan(gym, plan, [...selected], [], true);
      setChosen(new Set());
      setStep({ name: 'preview', rows });
    } catch (e) {
      setError((e as Error).message);
      setStep({ name: 'pick' });
    }
  };

  const apply = async (rows: AssignRow[]) => {
    setError(null);
    setStep({ name: 'applying' });
    try {
      const result = await assignPlan(gym, plan, [...selected], buildReplace(rows, chosen), false);
      setStep({
        name: 'done',
        applied: result.filter((r) => r.action === 'apply').length,
        skipped: result.filter((r) => r.action === 'skip').length,
      });
      onApplied();
    } catch (e) {
      setError((e as Error).message);
      setStep({ name: 'preview', rows });
    }
  };

  return (
    <div className="sheet" role="dialog" aria-label="Adicionar alunos ao plano">
      <div className="sheet-head">
        <h2>Adicionar alunos</h2>
        <button className="link" onClick={onClose}>
          Fechar
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      {step.name === 'pick' ? (
        <>
          <div className="filters">
            <label className="field">
              <span>Tem no plano</span>
              <input
                value={filters.hasExercise}
                onChange={(e) => setFilters((f) => ({ ...f, hasExercise: e.target.value }))}
                placeholder="Exercício"
              />
            </label>
            <label className="field">
              <span>Sem treinar há</span>
              <select
                value={filters.inactiveDays ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, inactiveDays: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">qualquer</option>
                <option value="7">7 dias ou mais</option>
                <option value="14">14 dias ou mais</option>
                <option value="30">30 dias ou mais</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={filters.onlyWithoutPlan}
                onChange={(e) => setFilters((f) => ({ ...f, onlyWithoutPlan: e.target.checked }))}
              />
              Só quem não está em nenhum plano
            </label>
            <button className="button" onClick={() => void search_()}>
              Buscar alunos
            </button>
          </div>

          {students ? (
            <>
              <div className="pick-head">
                <label className="field field-grow">
                  <span>Nome ou @</span>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar a lista" />
                </label>
                <button className="link" onClick={() => setSelected(new Set(visible.map((s) => s.user_id)))}>
                  Marcar os {visible.length} da lista
                </button>
                <button className="link" onClick={() => setSelected(new Set())}>
                  Desmarcar todos
                </button>
              </div>
              {visible.length === 0 ? <p className="muted pad">Nenhum aluno com esses filtros.</p> : null}
              <ul className="pick-list">
                {visible.map((s) => (
                  <li key={s.user_id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={selected.has(s.user_id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(s.user_id);
                          else next.delete(s.user_id);
                          setSelected(next);
                        }}
                      />
                      {studentName(s)}
                      <span className="muted">
                        {s.plan_ids?.length ? ' · em outro plano' : ''} · {s.trained_days} dias treinados
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="sheet-foot">
                <span className="muted">
                  <span className="num">{selected.size}</span> {selected.size === 1 ? 'aluno marcado' : 'alunos marcados'}
                </span>
                <button className="button button-accent" disabled={selected.size === 0} onClick={() => void preview()}>
                  Ver prévia
                </button>
              </div>
            </>
          ) : (
            <p className="muted pad">Escolha os filtros e busque os alunos.</p>
          )}
        </>
      ) : null}

      {step.name === 'loading' || step.name === 'applying' ? (
        <p className="muted pad">{step.name === 'loading' ? 'Montando a prévia' : 'Aplicando o plano'}</p>
      ) : null}

      {step.name === 'preview' ? (
        <Preview rows={step.rows} names={names} chosen={chosen} setChosen={setChosen} onBack={() => setStep({ name: 'pick' })} onApply={() => void apply(step.rows)} />
      ) : null}

      {step.name === 'done' ? (
        <div className="pad">
          <p>
            Plano aplicado em <span className="num">{step.applied}</span> {step.applied === 1 ? 'dia' : 'dias'}.
            {step.skipped > 0 ? ` ${step.skipped} ${step.skipped === 1 ? 'dia ficou' : 'dias ficaram'} como estava${step.skipped === 1 ? '' : 'm'}.` : ''}
          </p>
          <p className="muted">Os alunos recebem na próxima vez que abrirem o app.</p>
          <button className="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Preview({
  rows,
  names,
  chosen,
  setChosen,
  onBack,
  onApply,
}: {
  rows: AssignRow[];
  names: Map<string, string>;
  chosen: Set<string>;
  setChosen: (next: Set<string>) => void;
  onBack: () => void;
  onApply: () => void;
}) {
  const conflicts = rows.filter(isConflict);
  const byStudent = [...new Set(rows.map((r) => r.user_id))];
  const toApply = countToApply(rows, chosen);
  const toggle = (key: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(key);
    else next.delete(key);
    setChosen(next);
  };

  return (
    <>
      <p>
        {conflicts.length === 0
          ? 'Nenhum aluno tem treino nesses dias: o plano entra em todos.'
          : `${conflicts.length} ${conflicts.length === 1 ? 'dia já tem' : 'dias já têm'} treino. Marque o que o plano deve substituir; o resto fica como está.`}
      </p>
      {conflicts.length > 0 ? (
        <div className="pick-head">
          <button className="link" onClick={() => setChosen(new Set(conflicts.map((r) => pairKey(r.user_id, r.weekday))))}>
            Substituir todos
          </button>
          <button className="link" onClick={() => setChosen(new Set())}>
            Pular todos
          </button>
        </div>
      ) : null}
      <table className="table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Dias</th>
          </tr>
        </thead>
        <tbody>
          {byStudent.map((userId) => (
            <tr key={userId}>
              <td>{names.get(userId) ?? userId.slice(0, 6)}</td>
              <td>
                <ul className="preview-days">
                  {rows
                    .filter((r) => r.user_id === userId)
                    .map((r) => {
                      const key = pairKey(r.user_id, r.weekday);
                      return (
                        <li key={key}>
                          <span className="day-tag">{shortDay(r.weekday)}</span>
                          {isConflict(r) ? (
                            <label className="check">
                              <input type="checkbox" checked={chosen.has(key)} onChange={(e) => toggle(key, e.target.checked)} />
                              Substituir {CURRENT_LABEL[r.current].toLowerCase()}
                              {r.current_name ? ` "${r.current_name}"` : ''}
                            </label>
                          ) : (
                            <span className="muted">{CURRENT_LABEL[r.current]}</span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sheet-foot">
        <button className="link" onClick={onBack}>
          Voltar
        </button>
        <button className="button button-accent" disabled={toApply === 0} onClick={onApply}>
          Aplicar em {toApply} {toApply === 1 ? 'dia' : 'dias'}
        </button>
      </div>
    </>
  );
}

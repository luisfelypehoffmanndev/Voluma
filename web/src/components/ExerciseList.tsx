import { useId, useState } from 'react';

import { MOVEMENTS, type Movement } from '../lib/movements';
import { slugify } from '../lib/plans';

/** Uma linha do editor. `ref` e o id que ja existe no banco (exercicio da ficha ou do dia). */
export type ExerciseDraft = {
  key: string;
  ref?: string;
  movementSlug: string;
  name: string;
  muscleGroup: string | null;
  kind: 'strength' | 'run';
  sets: number;
  reps: number;
  distanceKm: number;
  durationMin: number;
  /** Diferente do treino do plano (so na tela do aluno). */
  exception?: boolean;
};

let seq = 0;
export function draftFromMovement(movement: Movement): ExerciseDraft {
  seq += 1;
  return {
    key: `novo-${seq}`,
    movementSlug: movement.slug,
    name: movement.name,
    muscleGroup: movement.group,
    kind: movement.kind,
    sets: 3,
    reps: 10,
    distanceKm: movement.kind === 'run' ? 5 : 0,
    durationMin: movement.kind === 'run' ? 30 : 0,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value) || min));

/**
 * Lista editavel de exercicios: numeros, ordem, tirar e acrescentar pela
 * biblioteca do app. Os limites sao os mesmos do app (TargetsEditor) e da RPC.
 */
export function ExerciseList({ value, onChange }: { value: ExerciseDraft[]; onChange: (next: ExerciseDraft[]) => void }) {
  const listId = useId();
  const [adding, setAdding] = useState('');

  const update = (index: number, patch: Partial<ExerciseDraft>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  const add = () => {
    const name = adding.trim();
    if (!name) return;
    const movement =
      MOVEMENTS.find((m) => m.name.toLowerCase() === name.toLowerCase()) ??
      ({ slug: slugify(name), name, group: '', kind: 'strength' } as Movement);
    if (value.some((item) => item.name.toLowerCase() === movement.name.toLowerCase())) {
      setAdding('');
      return;
    }
    onChange([...value, { ...draftFromMovement(movement), muscleGroup: movement.group || null }]);
    setAdding('');
  };

  return (
    <div className="exercise-list">
      {value.length === 0 ? <p className="muted">Nenhum exercício ainda.</p> : null}
      {value.map((item, index) => (
        <div key={item.key} className="exercise-row">
          <div className="exercise-name">
            <span>{item.name}</span>
            {item.exception ? <span className="muted"> · só deste aluno</span> : null}
          </div>
          {item.kind === 'run' ? (
            <>
              <label className="mini">
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={0.5}
                  value={item.distanceKm}
                  onChange={(e) => update(index, { distanceKm: Math.min(200, Math.max(0, Number(e.target.value))) })}
                />
                <span>km</span>
              </label>
              <label className="mini">
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={item.durationMin}
                  onChange={(e) => update(index, { durationMin: clamp(Number(e.target.value), 0, 600) })}
                />
                <span>min</span>
              </label>
            </>
          ) : (
            <>
              <label className="mini">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={item.sets}
                  onChange={(e) => update(index, { sets: clamp(Number(e.target.value), 1, 12) })}
                  aria-label={`Séries de ${item.name}`}
                />
                <span>séries</span>
              </label>
              <label className="mini">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={item.reps}
                  onChange={(e) => update(index, { reps: clamp(Number(e.target.value), 1, 100) })}
                  aria-label={`Repetições de ${item.name}`}
                />
                <span>reps</span>
              </label>
            </>
          )}
          <div className="row-actions">
            <button className="link" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${item.name}`}>
              ↑
            </button>
            <button
              className="link"
              disabled={index === value.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`Descer ${item.name}`}
            >
              ↓
            </button>
            <button className="link" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              Tirar
            </button>
          </div>
        </div>
      ))}
      <div className="exercise-add">
        <input
          list={listId}
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Adicionar exercício"
          aria-label="Adicionar exercício"
        />
        <datalist id={listId}>
          {MOVEMENTS.map((m) => (
            <option key={m.slug} value={m.name} />
          ))}
        </datalist>
        <button className="button" onClick={add} disabled={!adding.trim()}>
          Adicionar
        </button>
      </div>
    </div>
  );
}

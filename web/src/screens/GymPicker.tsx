import type { Membership } from '../lib/data';
import { gymConfig } from '../lib/gyms';

export function GymPicker({ memberships, onPick }: { memberships: Membership[]; onPick: (gym: string) => void }) {
  return (
    <main className="center">
      <div className="center-box">
        <h1 className="title">Qual academia?</h1>
        <ul className="picker">
          {memberships.map((m) => {
            const config = gymConfig(m.gym_id);
            return (
              <li key={m.gym_id}>
                <button className="picker-item" onClick={() => onPick(m.gym_id)}>
                  <span className="swatch" style={{ background: config.accent }} aria-hidden />
                  <span>{config.name}</span>
                  <span className="muted">{m.role === 'admin' ? 'admin' : 'instrutor'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

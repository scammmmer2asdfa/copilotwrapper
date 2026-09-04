import React from 'react';

interface Props {
  connectState: string;
  queueDepth: number;
  modes: { id: string; name: string }[];
  currentModeId: string | null;
  onModeChange: (modeId: string) => void;
}

export function StatusRail({ connectState, queueDepth, modes, currentModeId, onModeChange }: Props): React.JSX.Element {
  return (
    <div className="status-rail">
      <div className="status-rail__section">
        <div className="status-rail__label">Connection</div>
        <div className={`status-pill status-pill--${connectState}`}>{connectState}</div>
      </div>

      <div className="status-rail__section">
        <div className="status-rail__label">Queue</div>
        <div className="status-rail__value">{queueDepth} pending</div>
      </div>

      {modes.length > 0 && (
        <div className="status-rail__section">
          <div className="status-rail__label">Mode</div>
          <select value={currentModeId ?? ''} onChange={(e) => onModeChange(e.target.value)}>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

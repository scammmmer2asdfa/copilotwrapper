import React from 'react';
import { useEscapeKey } from '../useEscapeKey';

export interface PermissionOptionView {
  optionId: string;
  name: string;
  kind: string;
}

interface Props {
  toolTitle: string;
  options: PermissionOptionView[];
  onChoose: (optionId: string | null) => void;
}

/**
 * Blocks on the agent's own `session/request_permission` call — nothing else
 * in the session can proceed until the user (or a cancel) resolves this.
 */
export function PermissionDialog({ toolTitle, options, onChoose }: Props): React.JSX.Element {
  useEscapeKey(() => onChoose(null));

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Permission requested</h3>
        <p>
          Copilot wants to run: <strong>{toolTitle}</strong>
        </p>
        <div className="modal__actions">
          {options.map((o) => (
            <button key={o.optionId} onClick={() => onChoose(o.optionId)} autoFocus={o.kind === 'allow_once'}>
              {o.name}
            </button>
          ))}
          <button onClick={() => onChoose(null)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

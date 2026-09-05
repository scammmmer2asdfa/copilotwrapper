import React, { useEffect, useState } from 'react';
import type { CodespaceSummary } from '../../../shared/ipc';
import { useEscapeKey } from '../useEscapeKey';
import { Icon } from './Icon';

interface Props {
  onAdd: (codespace: CodespaceSummary) => void;
  onClose: () => void;
}

/** Lists the user's real GitHub Codespaces (via `gh api user/codespaces`) to open as a tab. */
export function CodespacePicker({ onAdd, onClose }: Props): React.JSX.Element {
  const [codespaces, setCodespaces] = useState<CodespaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.copilotDesktop.codespaces
      .list()
      .then(setCodespaces)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEscapeKey(onClose);

  return (
    <div className="modal-overlay">
      <div className="modal modal--codespaces">
        <h3>Open a Codespace</h3>

        {error && (
          <p className="auth-panel__error">
            Couldn't list codespaces: {error}. Make sure the <code>gh</code> CLI is installed and signed in
            (<code>gh auth login</code>).
          </p>
        )}

        {!error && !codespaces && <p>Loading your codespaces…</p>}

        {codespaces && codespaces.length === 0 && <p>No codespaces found for your account.</p>}

        {codespaces && codespaces.length > 0 && (
          <ul className="codespace-picker__list">
            {codespaces.map((c) => (
              <li key={c.name}>
                <div className="codespace-picker__info">
                  <strong>{c.displayName}</strong>
                  <span className="codespace-picker__repo mono">{c.repository}</span>
                  <span className={`status-pill status-pill--${c.state === 'Available' ? 'connected' : 'disconnected'}`}>
                    {c.state}
                  </span>
                </div>
                <button onClick={() => onAdd(c)}>
                  <Icon name="cloud" size={14} /> Open
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="modal__actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

interface Props {
  code: string | null;
  url: string | null;
  running: boolean;
  done: boolean | null;
  onStart: () => void;
  onCancel: () => void;
}

/** Runs `copilot login` and shows the scraped device code — no token ever touches this UI. */
export function AuthPanel({ code, url, running, done, onStart, onCancel }: Props): React.JSX.Element {
  return (
    <div className="auth-panel">
      <h2>Sign in to GitHub Copilot</h2>
      {!running && done === null && <button onClick={onStart}>Start login</button>}

      {running && !code && <p>Starting `copilot login`…</p>}

      {code && (
        <div className="auth-panel__code">
          <div className="auth-panel__device-code mono">{code}</div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          )}
          <p>Enter this code on the page above to finish signing in.</p>
        </div>
      )}

      {running && (
        <button onClick={onCancel} className="auth-panel__cancel">
          Cancel
        </button>
      )}

      {done === false && <p className="auth-panel__error">Login did not complete. Try again.</p>}
      {done === true && <p className="auth-panel__success">Signed in.</p>}
    </div>
  );
}

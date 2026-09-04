import React, { useEffect, useState } from 'react';

interface EnvironmentStatus {
  nodeVersion: string | null;
  npmVersion: string | null;
  bundledCliPath: string;
  systemCliPath: string | null;
}

interface Props {
  onContinue: () => void;
}

/** First-run screen: shows what's detected on the system before handing off to the main app. */
export function SetupWizard({ onContinue }: Props): React.JSX.Element {
  const [status, setStatus] = useState<EnvironmentStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installOutput, setInstallOutput] = useState('');
  const [installDone, setInstallDone] = useState<boolean | null>(null);

  useEffect(() => {
    void window.copilotDesktop.environment.check().then(setStatus);

    const offOutput = window.copilotDesktop.environment.onInstallOutput((chunk: string) =>
      setInstallOutput((prev) => prev + chunk)
    );
    const offDone = window.copilotDesktop.environment.onInstallDone((success: boolean) => {
      setInstalling(false);
      setInstallDone(success);
      void window.copilotDesktop.environment.check().then(setStatus);
    });
    return () => {
      offOutput();
      offDone();
    };
  }, []);

  return (
    <div className="overlay-panel">
      <div className="setup-wizard">
        <h2>Welcome to Copilot Desktop</h2>
        <p className="settings-hint">Here's what's available on this machine before you get started.</p>

        {!status && <p>Checking your environment…</p>}

        {status && (
          <ul className="setup-wizard__checks">
            <li>
              <span className="setup-wizard__status">✓</span> Copilot CLI (bundled):{' '}
              <span className="mono">{status.bundledCliPath}</span>
            </li>
            <li>
              <span className="setup-wizard__status">{status.systemCliPath ? '✓' : '○'}</span> Copilot CLI
              (system):{' '}
              <span className="mono">{status.systemCliPath ?? 'not found on PATH'}</span>
            </li>
            <li>
              <span className="setup-wizard__status">{status.nodeVersion ? '✓' : '○'}</span> Node.js:{' '}
              <span className="mono">{status.nodeVersion ?? 'not found on PATH'}</span>
            </li>
            <li>
              <span className="setup-wizard__status">{status.npmVersion ? '✓' : '○'}</span> npm:{' '}
              <span className="mono">{status.npmVersion ?? 'not found on PATH'}</span>
            </li>
          </ul>
        )}

        <p className="settings-hint">
          The bundled CLI works out of the box — installing it globally is optional, but avoids macOS's
          quarantine flag on the app bundle and lets you use the same CLI from your own terminal.
        </p>

        {status?.npmVersion && !status.systemCliPath && (
          <button
            disabled={installing}
            onClick={() => {
              setInstalling(true);
              setInstallDone(null);
              setInstallOutput('');
              void window.copilotDesktop.environment.installCli();
            }}
          >
            {installing ? 'Installing…' : 'Install Copilot CLI globally'}
          </button>
        )}

        {installOutput && <pre className="setup-wizard__output mono">{installOutput}</pre>}
        {installDone === false && <p className="auth-panel__error">Install failed — see output above.</p>}
        {installDone === true && <p className="auth-panel__success">Installed.</p>}

        <div className="modal__actions">
          <button className="button--primary" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

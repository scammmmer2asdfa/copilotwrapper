import React, { useEffect, useRef, useState } from 'react';
import { TerminalPanel } from './TerminalPanel';

interface Props {
  cwd: string;
  onClose: () => void;
}

/** Bottom panel with a real terminal and a live view of the agent's own stderr — like VS Code's Terminal/Output split. */
export function BottomPanel({ cwd, onClose }: Props): React.JSX.Element {
  const [tab, setTab] = useState<'terminal' | 'agent-output'>('terminal');
  const [agentOutput, setAgentOutput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = window.copilotDesktop.agent.onStderr((chunk: string) => setAgentOutput((prev) => prev + chunk));
    return off;
  }, []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [agentOutput, tab]);

  return (
    <div className="bottom-panel">
      <div className="bottom-panel__tabs">
        <button className={tab === 'terminal' ? 'active' : ''} onClick={() => setTab('terminal')}>
          Terminal
        </button>
        <button className={tab === 'agent-output' ? 'active' : ''} onClick={() => setTab('agent-output')}>
          Agent Output
        </button>
        <button className="bottom-panel__close" onClick={onClose} title="Close panel">
          ✕
        </button>
      </div>
      <div className="bottom-panel__body" style={{ display: tab === 'terminal' ? 'block' : 'none' }}>
        <TerminalPanel id="main" cwd={cwd} />
      </div>
      {tab === 'agent-output' && (
        <div className="bottom-panel__body bottom-panel__output mono" ref={outputRef}>
          <pre>{agentOutput || '(no output yet)'}</pre>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  id: string;
  cwd: string;
}

/** A real, PTY-backed terminal (node-pty in the main process) — an actual shell, not a log view. */
export function TerminalPanel({ id, cwd }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
      fontSize: 13,
      theme: { background: '#00000000' },
      cursorBlink: true
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    void window.copilotDesktop.terminal.create(id, cwd, term.cols, term.rows);

    const offData = window.copilotDesktop.terminal.onData((termId: string, chunk: string) => {
      if (termId === id) term.write(chunk);
    });
    const offExit = window.copilotDesktop.terminal.onExit((termId: string) => {
      if (termId === id) term.write('\r\n[process exited]\r\n');
    });

    const onKeyDispose = term.onData((data) => window.copilotDesktop.terminal.write(id, data));

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      window.copilotDesktop.terminal.resize(id, term.cols, term.rows);
    });
    resizeObserver.observe(container);

    return () => {
      offData();
      offExit();
      onKeyDispose.dispose();
      resizeObserver.disconnect();
      window.copilotDesktop.terminal.kill(id);
      term.dispose();
    };
  }, [id, cwd]);

  return <div className="terminal-panel__surface" ref={containerRef} />;
}

import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';

export interface TerminalManagerEvents {
  data: (id: string, chunk: string) => void;
  exit: (id: string, code: number) => void;
}

/**
 * Owns real PTY-backed terminal sessions (via node-pty, the same library
 * VS Code's own integrated terminal uses) — a genuine shell, not a
 * simulated log view.
 */
export class TerminalManager extends EventEmitter {
  private terminals = new Map<string, pty.IPty>();

  create(id: string, cwd: string, cols = 80, rows = 24): void {
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
    const term = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>
    });
    term.onData((chunk) => this.emit('data', id, chunk));
    term.onExit(({ exitCode }) => {
      this.terminals.delete(id);
      this.emit('exit', id, exitCode);
    });
    this.terminals.set(id, term);
  }

  write(id: string, data: string): void {
    this.terminals.get(id)?.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.terminals.get(id)?.resize(cols, rows);
  }

  kill(id: string): void {
    this.terminals.get(id)?.kill();
    this.terminals.delete(id);
  }

  killAll(): void {
    for (const term of this.terminals.values()) term.kill();
    this.terminals.clear();
  }
}

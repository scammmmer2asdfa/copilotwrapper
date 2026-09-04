import { spawn } from 'node:child_process';
import { platform } from 'node:process';

export type EditorId = 'vscode' | 'cursor' | 'zed' | 'sublime' | 'webstorm' | 'vim' | 'custom' | 'system';

export interface EditorConfig {
  id: EditorId;
  /** Absolute path to a custom binary, only used when id === 'custom'. */
  customBinary?: string;
}

interface EditorSpec {
  /** Command name to look up on PATH. */
  bin: string;
  /** Builds CLI args to open `target` (optionally at `line`). */
  args: (target: string, line?: number) => string[];
}

const EDITORS: Record<Exclude<EditorId, 'custom' | 'system'>, EditorSpec> = {
  vscode: { bin: 'code', args: (t, l) => (l ? ['--goto', `${t}:${l}`] : [t]) },
  cursor: { bin: 'cursor', args: (t, l) => (l ? ['--goto', `${t}:${l}`] : [t]) },
  zed: { bin: 'zed', args: (t, l) => [l ? `${t}:${l}` : t] },
  sublime: { bin: 'subl', args: (t, l) => [l ? `${t}:${l}` : t] },
  webstorm: { bin: 'webstorm', args: (t, l) => (l ? ['--line', String(l), t] : [t]) },
  vim: { bin: 'vim', args: (t, l) => (l ? [`+${l}`, t] : [t]) }
};

/** Opens `filePath` (optionally at `line`) in the configured editor. */
export function openInEditor(config: EditorConfig, filePath: string, line?: number): void {
  if (config.id === 'system') {
    openWithSystemDefault(filePath);
    return;
  }

  if (config.id === 'custom') {
    if (!config.customBinary) throw new Error('custom editor selected but no binary path configured');
    spawn(config.customBinary, [filePath], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  const spec = EDITORS[config.id];
  if (!spec) throw new Error(`unknown editor: ${config.id}`);
  spawn(spec.bin, spec.args(filePath, line), { detached: true, stdio: 'ignore' }).unref();
}

function openWithSystemDefault(filePath: string): void {
  if (platform === 'darwin') {
    spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref();
  } else if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '""', filePath], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' }).unref();
  }
}

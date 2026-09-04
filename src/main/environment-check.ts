import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

const execFileAsync = promisify(execFile);

export interface EnvironmentStatus {
  /** Version string if a system Node.js is on PATH, else null. Electron bundles its own Node, so this is only needed for `npm install -g`. */
  nodeVersion: string | null;
  npmVersion: string | null;
  /** Always present — the bundled/resolved CLI this app will use. */
  bundledCliPath: string;
  /** A `copilot` found on PATH distinct from the bundled one, if any. */
  systemCliPath: string | null;
}

async function tryVersion(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(bin, ['--version']);
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function checkEnvironment(bundledCliPath: string, systemCliPath: string | null): Promise<EnvironmentStatus> {
  const [nodeVersion, npmVersion] = await Promise.all([
    tryVersion('node'),
    tryVersion(process.platform === 'win32' ? 'npm.cmd' : 'npm')
  ]);
  return { nodeVersion, npmVersion, bundledCliPath, systemCliPath };
}

export interface InstallEvents {
  output: (chunk: string) => void;
  done: (success: boolean) => void;
}

/** Runs `npm install -g @github/copilot`, streaming output back for display. */
export class CliInstaller extends EventEmitter {
  private child: ReturnType<typeof spawn> | null = null;

  run(): void {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    this.child = spawn(npmCmd, ['install', '-g', '@github/copilot'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const onData = (chunk: Buffer) => this.emit('output', chunk.toString('utf8'));
    this.child.stdout?.on('data', onData);
    this.child.stderr?.on('data', onData);
    this.child.on('exit', (code) => {
      this.emit('done', code === 0);
      this.child = null;
    });
  }

  isRunning(): boolean {
    return this.child !== null;
  }
}

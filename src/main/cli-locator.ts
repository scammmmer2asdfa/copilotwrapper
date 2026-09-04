import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type Platform = 'darwin-arm64' | 'darwin-x64' | 'win32-x64' | 'linux-x64';

export function detectPlatform(): Platform {
  const { platform, arch } = process;
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
  if (platform === 'win32' && arch === 'x64') return 'win32-x64';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  throw new Error(`Unsupported platform/arch: ${platform}-${arch}`);
}

export function binaryName(platform: Platform): string {
  return platform === 'win32-x64' ? 'copilot.exe' : 'copilot';
}

export interface LocateOptions {
  /** process.resourcesPath when packaged, project root in dev */
  resourcesPath: string;
  /** directory containing node_modules (project root) */
  appRoot: string;
}

/**
 * Resolves the copilot CLI binary. Checked in order:
 * 1. `<resourcesPath>/copilot-cli/<name>` — the packaged layout: each
 *    platform's installer bundles only its own binary flat under
 *    `resources/copilot-cli/` (see electron-builder.yml extraResources).
 * 2. `<appRoot>/resources/copilot-cli/<platform>/<name>` — the dev layout
 *    produced by `npm run fetch-cli` (scripts/fetch-cli.mjs), keyed by
 *    platform since a dev machine only ever fetches its own platform.
 * 3. `node_modules/@github/copilot-<platform>/copilot`.
 * 4. PATH.
 */
export function locateCli(opts: LocateOptions): string {
  const platform = detectPlatform();
  const name = binaryName(platform);

  const packaged = join(opts.resourcesPath, 'copilot-cli', name);
  if (existsSync(packaged)) return packaged;

  const devFetched = join(opts.appRoot, 'resources', 'copilot-cli', platform, name);
  if (existsSync(devFetched)) return devFetched;

  const inNodeModules = join(opts.appRoot, 'node_modules', `@github/copilot-${platform}`, 'copilot');
  if (existsSync(inNodeModules)) return inNodeModules;

  const onPath = findOnPath(name);
  if (onPath) return onPath;

  throw new Error(
    `Could not locate the copilot CLI binary for ${platform}. Run "npm run fetch-cli" or install @github/copilot and ensure it is on PATH.`
  );
}

function findOnPath(name: string): string | null {
  const pathEnv = process.env.PATH ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

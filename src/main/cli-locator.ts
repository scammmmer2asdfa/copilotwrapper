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
  /**
   * User-configured override (Settings → "Copilot CLI location"), e.g.
   * pointing at a `copilot` the user installed themselves via
   * `npm install -g @github/copilot`. Takes priority over everything else,
   * and unlike the bundled binary is very unlikely to carry a macOS
   * quarantine flag (that's only attached by quarantine-aware download
   * paths like browsers, not by npm/CLI installs).
   */
  overridePath?: string;
}

/**
 * Resolves the copilot CLI binary. Checked in order:
 * 1. `opts.overridePath` — explicit user setting, if configured and it exists.
 * 2. `<resourcesPath>/copilot-cli/<name>` — the packaged layout: each
 *    platform's installer bundles only its own binary flat under
 *    `resources/copilot-cli/` (see electron-builder.yml extraResources).
 * 3. `<appRoot>/resources/copilot-cli/<platform>/<name>` — the dev layout:
 *    binaries for all 4 platforms are vendored directly in the repo (via Git
 *    LFS), so this works right after a fresh clone. `npm run fetch-cli` still
 *    exists to re-fetch/update them to a newer published CLI version.
 * 4. `node_modules/@github/copilot-<platform>/copilot`.
 * 5. PATH.
 */
export function locateCli(opts: LocateOptions): string {
  const platform = detectPlatform();
  const name = binaryName(platform);

  if (opts.overridePath && existsSync(opts.overridePath)) return opts.overridePath;

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

/** A `copilot` on PATH, e.g. from `npm install -g @github/copilot` — used for the setup wizard's detection status, distinct from the bundled binary. */
export function locateSystemCli(): string | null {
  return findOnPath(binaryName(detectPlatform()));
}


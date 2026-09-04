#!/usr/bin/env node
/**
 * Downloads the copilot CLI binary for the current (or requested) platform
 * from the real, published `@github/copilot-<platform>` npm packages into
 * resources/copilot-cli/<platform>/.
 *
 * The binaries for all 4 platforms are already vendored in the repo (via Git
 * LFS) — a fresh clone doesn't need this. Re-run it to update to a newer
 * published CLI version, then commit the result.
 *
 * Usage: node scripts/fetch-cli.mjs [platform ...]
 *   platform: darwin-arm64 | darwin-x64 | win32-x64 | linux-x64 (default: current)
 */
import { mkdir, chmod, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { x as extractTar } from 'tar';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const PLATFORM_PACKAGES = {
  'darwin-arm64': '@github/copilot-darwin-arm64',
  'darwin-x64': '@github/copilot-darwin-x64',
  'win32-x64': '@github/copilot-win32-x64',
  'linux-x64': '@github/copilot-linux-x64'
};

function currentPlatform() {
  const { platform, arch } = process;
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
  if (platform === 'win32' && arch === 'x64') return 'win32-x64';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  throw new Error(`Unsupported platform/arch: ${platform}-${arch}`);
}

function binaryName(platform) {
  return platform === 'win32-x64' ? 'copilot.exe' : 'copilot';
}

async function fetchPlatform(platform) {
  const pkg = PLATFORM_PACKAGES[platform];
  if (!pkg) throw new Error(`Unknown platform: ${platform}`);

  const destDir = join(root, 'resources', 'copilot-cli', platform);
  await mkdir(destDir, { recursive: true });

  const tmpDir = join(root, '.tmp-fetch-cli', platform);
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  console.log(`Fetching ${pkg} ...`);
  // On Windows, npm is a .cmd shim — spawning it directly (even by exact
  // name) throws EINVAL, since .cmd files aren't real executables and must
  // run through cmd.exe. /d /s /c matches how GitHub's own runner invokes
  // npm.cmd internally.
  const [npmCommand, npmArgs] =
    process.platform === 'win32'
      ? ['cmd.exe', ['/d', '/s', '/c', 'npm', 'pack', pkg, '--silent']]
      : ['npm', ['pack', pkg, '--silent']];
  const { stdout: packResult } = await execFileAsync(npmCommand, npmArgs, { cwd: tmpDir });
  const tarballName = packResult.trim().split('\n').pop();
  const tarballPath = join(tmpDir, tarballName);

  await extractTar({ file: tarballPath, cwd: tmpDir });

  const name = binaryName(platform);
  const extractedBinary = join(tmpDir, 'package', name);
  if (!existsSync(extractedBinary)) {
    throw new Error(`Expected binary not found at ${extractedBinary} after extracting ${pkg}`);
  }

  const destBinary = join(destDir, name);
  await copyFile(extractedBinary, destBinary);

  if (platform !== 'win32-x64') {
    await chmod(destBinary, 0o755);
  }

  await rm(tmpDir, { recursive: true, force: true });
  console.log(`-> ${destBinary}`);
  return destBinary;
}

async function main() {
  const requested = process.argv.slice(2);
  const platforms = requested.length > 0 ? requested : [currentPlatform()];
  for (const platform of platforms) {
    await fetchPlatform(platform);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

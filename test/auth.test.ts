import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthRunner } from '../src/main/auth.js';

const CLI_PATH = join(process.cwd(), 'resources', 'copilot-cli', 'linux-x64', 'copilot');
const hasCli = existsSync(CLI_PATH);

/**
 * Integration test against the REAL CLI's login flow. Verifies the fix for a
 * real bug: `copilot login` defaults to a browser-based web flow on a local
 * desktop (only headless/remote environments default to the device code
 * flow), which never prints anything our device-code scraper can match -
 * the auth panel would hang forever on "Starting copilot login...". Forcing
 * --device-code (see auth.ts) makes the flow, and its output, deterministic
 * regardless of platform/environment.
 */
describe.skipIf(!hasCli)('AuthRunner against the real copilot login', () => {
  let runner: AuthRunner | undefined;
  let tmpHome: string | undefined;

  afterEach(() => {
    runner?.cancel();
    runner = undefined;
    if (tmpHome) rmSync(tmpHome, { recursive: true, force: true });
  });

  it('forces --device-code and scrapes the real "enter code XXXX-XXXX" output', async () => {
    runner = new AuthRunner();
    // A clean, isolated HOME with no cached credential store and no
    // inherited COPILOT_GITHUB_TOKEN/GH_TOKEN/GITHUB_TOKEN - otherwise the
    // CLI silently succeeds via an ambient token with no code to scrape.
    tmpHome = mkdtempSync(join(tmpdir(), 'copilot-desktop-auth-test-'));
    const cleanEnv: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: tmpHome };

    const result = await new Promise<{ code: string; url?: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out waiting for a device code')), 15000);
      runner!.on('code', (info) => {
        clearTimeout(timeout);
        resolve(info);
      });
      runner!.run({ command: CLI_PATH, args: ['login'], label: 'Copilot Login' }, cleanEnv);
    });

    expect(result.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(result.url).toBe('https://github.com/login/device');
  });
});


import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chmodSync } from 'node:fs';

const BUILT_MAIN = join(process.cwd(), 'out', 'main', 'index.js');

let electronApp: ElectronApplication;
let window: Page;
let userDataDir: string;

/**
 * Real E2E tests against the actual built app (npm run build first), driven
 * through the genuine Electron process via Playwright's Electron support —
 * not a mocked renderer. Skipped if the build output doesn't exist.
 */
test.beforeAll(async () => {
  test.skip(!existsSync(BUILT_MAIN), 'Run `npm run build` before the e2e suite (out/main/index.js not found)');

  // Best-effort: dev-mode vendored CLI binaries lose +x after a fresh git
  // checkout on posix (git doesn't always preserve the bit through LFS).
  for (const p of ['resources/copilot-cli/linux-x64/copilot', 'resources/copilot-cli/darwin-arm64/copilot', 'resources/copilot-cli/darwin-x64/copilot']) {
    try {
      chmodSync(join(process.cwd(), p), 0o755);
    } catch {
      // not on this platform / not present, fine
    }
  }

  userDataDir = mkdtempSync(join(tmpdir(), 'copilot-desktop-e2e-'));
  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: process.cwd()
  });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp?.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

test.describe.serial('Copilot Desktop', () => {
  test('shows the setup wizard on first launch', async () => {
    await expect(window.getByText('Welcome to Copilot Desktop')).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/01-setup-wizard.png' });
  });

  test('setup wizard shows environment detection results', async () => {
    await expect(window.getByText(/Copilot CLI \(bundled\)/)).toBeVisible();
    await expect(window.getByText(/Node\.js:/)).toBeVisible();
  });

  test('dismissing the setup wizard reveals the main layout', async () => {
    await window.getByRole('button', { name: 'Continue' }).click();
    await expect(window.locator('.icon-rail')).toBeVisible();
    await expect(window.locator('.chat-log')).toBeVisible();
    await expect(window.locator('.status-rail')).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/02-main-layout.png' });
  });

  test('connects to the real copilot --acp subprocess', async () => {
    await expect(window.locator('.status-pill')).toHaveText('connected', { timeout: 15000 });
  });

  test('opens the settings panel and switches theme', async () => {
    await window.locator('.icon-rail__settings').click();
    await expect(window.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/03-settings.png' });

    await window.getByLabel('Theme').selectOption('github-dark');
    await expect(window.locator('html')).toHaveAttribute('data-theme', 'github-dark');
    await window.screenshot({ path: 'test-results/screenshots/04-settings-github-dark.png' });

    // Reset back so later tests/screenshots aren't affected by theme order.
    await window.getByLabel('Theme').selectOption('graphite');
    await window.getByRole('button', { name: 'Close' }).click();
  });

  test('opens the terminal panel with Terminal and Agent Output tabs', async () => {
    await window.locator('.icon-rail__terminal').click();
    await expect(window.locator('.bottom-panel')).toBeVisible();
    await expect(window.getByRole('button', { name: 'Terminal' })).toBeVisible();
    await expect(window.getByRole('button', { name: 'Agent Output' })).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/05-terminal-panel.png' });

    await window.getByRole('button', { name: 'Agent Output' }).click();
    await expect(window.locator('.bottom-panel__output')).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/06-agent-output.png' });
  });
});

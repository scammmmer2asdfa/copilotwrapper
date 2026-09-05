import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BUILT_MAIN = join(process.cwd(), 'out', 'main', 'index.js');

let electronApp: ElectronApplication;
let window: Page;
let userDataDir: string;

/**
 * Real E2E tests against the actual built app (npm run build first), driven
 * through the genuine Electron process via Playwright's Electron support.
 * The `gh` CLI on a CI runner isn't authenticated as a real user, so
 * codespace-listing assertions only check the picker handles that
 * gracefully (loading -> some non-loading state), not specific real data.
 */
test.beforeAll(async () => {
  test.skip(!existsSync(BUILT_MAIN), 'Run `npm run build` before the e2e suite (out/main/index.js not found)');

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

test.describe.serial('Copilot Desktop (Codespaces shell)', () => {
  test('shows the empty state with no codespaces open', async () => {
    await expect(window.getByText('No codespaces open.')).toBeVisible();
    await expect(window.locator('.app__empty').getByRole('button', { name: 'Open a codespace' })).toBeVisible();
  });

  test('opens the codespace picker and it resolves out of the loading state', async () => {
    await window.locator('.icon-rail__new').click();
    await expect(window.getByRole('heading', { name: 'Open a Codespace' })).toBeVisible();
    await expect(window.getByText('Loading your codespaces…')).toBeHidden({ timeout: 15000 });
    await window.screenshot({ path: 'test-results/screenshots/01-codespace-picker.png' });
  });

  test('opening a codespace (if any are available) adds a tab', async () => {
    const openButton = window.locator('.codespace-picker__list button', { hasText: 'Open' }).first();
    if ((await openButton.count()) === 0) {
      test.skip(true, 'no real codespaces available to this gh account in this environment');
    }
    await openButton.click();
    await expect(window.locator('.icon-rail__item')).toHaveCount(1);
    await expect(window.locator('.codespace-view webview')).toHaveCount(1);
    await window.screenshot({ path: 'test-results/screenshots/02-codespace-tab.png' });
  });

  test('opens the terminal panel and closes it', async () => {
    await window.locator('.icon-rail__terminal').click();
    const bottomPanel = window.locator('.bottom-panel');
    await expect(bottomPanel).toBeVisible();
    await expect(bottomPanel.getByText('Terminal')).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/03-terminal-panel.png' });

    await window.locator('.bottom-panel__close').click();
    await expect(bottomPanel).toBeHidden();
  });

  test('opens the theme menu and switches theme', async () => {
    await window.locator('.icon-rail__settings').click();
    await expect(window.locator('.theme-menu')).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/04-theme-menu.png' });

    await window.locator('.theme-menu button', { hasText: /^GitHub Dark$/ }).click();
    await expect(window.locator('html')).toHaveAttribute('data-theme', 'github-dark');
    await window.screenshot({ path: 'test-results/screenshots/05-github-dark.png' });

    // Reset so later runs/screenshots aren't affected by theme order.
    await window.locator('.icon-rail__settings').click();
    await window.locator('.theme-menu button', { hasText: 'Graphite' }).click();
  });

  test('Right Shift opens the quick browse panel, Escape closes it', async () => {
    await window.keyboard.press('ShiftRight');
    await expect(window.locator('.modal--browse')).toBeVisible();
    await window.screenshot({ path: 'test-results/screenshots/06-quick-browse.png' });

    await window.keyboard.press('Escape');
    await expect(window.locator('.modal--browse')).toBeHidden();
  });

  test('Right Shift again reopens it (toggle behavior)', async () => {
    await window.keyboard.press('ShiftRight');
    await expect(window.locator('.modal--browse')).toBeVisible();
    await window.keyboard.press('ShiftRight');
    await expect(window.locator('.modal--browse')).toBeHidden();
  });
});

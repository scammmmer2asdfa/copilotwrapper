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
 * Tabs load real github.com pages, so these tests don't assume the runner
 * is signed in — they only assert the tab/webview mechanics, not that a
 * real codespace can be opened.
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
  test('shows the empty state with no tabs open', async () => {
    await expect(window.getByText('No tabs open.')).toBeVisible();
    await expect(window.locator('.app__empty').getByRole('button', { name: 'Sign in to github.com' })).toBeVisible();
  });

  test('clicking + opens a new tab pointed at github.com', async () => {
    await window.locator('.icon-rail__new').click();
    await expect(window.locator('.icon-rail__item')).toHaveCount(1);

    const webview = window.locator('.tab-view webview');
    await expect(webview).toHaveCount(1);
    await expect(webview).toHaveAttribute('src', /^https:\/\/github\.com/);
    await window.screenshot({ path: 'test-results/screenshots/01-github-tab.png' });
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

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CodespaceInfo {
  name: string;
  displayName: string;
  repository: string;
  state: string;
  lastUsedAt: string;
  /** The codespace's own web editor URL (github.dev), for embedding directly in a <webview>. */
  webUrl: string;
}

const GH_CMD = process.platform === 'win32' ? 'gh.exe' : 'gh';

interface RawApiCodespace {
  name: string;
  display_name: string;
  repository: { full_name: string };
  state: string;
  last_used_at: string;
  web_url: string;
}

/**
 * Lists the signed-in user's GitHub Codespaces via the `gh` CLI (not a
 * GitHub API token this app holds itself). Uses `gh api` directly rather
 * than `gh codespace list --json` because the latter's JSON fields don't
 * include `web_url` (verified against the real GitHub API response) — that
 * URL is exactly what gets embedded in the in-app browser view.
 */
export async function listCodespaces(): Promise<CodespaceInfo[]> {
  const { stdout } = await execFileAsync(GH_CMD, ['api', 'user/codespaces']);
  const parsed = JSON.parse(stdout) as { codespaces: RawApiCodespace[] };
  return parsed.codespaces.map((c) => ({
    name: c.name,
    displayName: c.display_name,
    repository: c.repository.full_name,
    state: c.state,
    lastUsedAt: c.last_used_at,
    webUrl: c.web_url
  }));
}

/** Opens a codespace in the browser-based VS Code via `gh codespace code --web`, which handles launching the OS browser itself. */
export function openCodespace(name: string): void {
  spawn(GH_CMD, ['codespace', 'code', '-c', name, '--web'], { detached: true, stdio: 'ignore' }).unref();
}


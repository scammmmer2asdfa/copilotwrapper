import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { listCodespaces } from '../src/main/codespaces.js';

function isGhAuthenticated(): boolean {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const hasGh = isGhAuthenticated();

/**
 * Integration test against the REAL `gh` CLI - no mocked GitHub API. Skipped
 * if `gh` isn't installed or isn't authenticated as a real user (CI runners'
 * default GITHUB_TOKEN is a repo-scoped installation token, not a user
 * token, and can't list a user's codespaces).
 */
describe.skipIf(!hasGh)('listCodespaces against the real gh CLI', () => {
  it('returns an array shaped like CodespaceInfo, including a real webUrl', async () => {
    const codespaces = await listCodespaces();
    expect(Array.isArray(codespaces)).toBe(true);
    for (const c of codespaces) {
      expect(c.name).toBeTruthy();
      expect(c.webUrl).toMatch(/^https:\/\/.+\.github\.dev$/);
      expect(c.repository).toContain('/');
    }
  });
});

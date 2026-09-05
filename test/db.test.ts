import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/main/db.js';

describe('db', () => {
  it('persists and retrieves settings', () => {
    const db = openDatabase(':memory:');
    db.setSetting('theme', 'github-dark');
    expect(db.getSetting('theme')).toBe('github-dark');
    expect(db.allSettings()).toEqual({ theme: 'github-dark' });
    db.close();
  });

  it('overwrites an existing setting rather than duplicating it', () => {
    const db = openDatabase(':memory:');
    db.setSetting('theme', 'graphite');
    db.setSetting('theme', 'paper');
    expect(db.getSetting('theme')).toBe('paper');
    expect(Object.keys(db.allSettings())).toHaveLength(1);
    db.close();
  });

  it('adds codespace tabs in increasing position order', () => {
    const db = openDatabase(':memory:');
    const a = db.addCodespaceTab({ codespaceName: 'a', displayName: 'A', repository: 'me/a', webUrl: 'https://a.github.dev' });
    const b = db.addCodespaceTab({ codespaceName: 'b', displayName: 'B', repository: 'me/b', webUrl: 'https://b.github.dev' });

    expect(a.position).toBe(0);
    expect(b.position).toBe(1);

    const tabs = db.listCodespaceTabs();
    expect(tabs.map((t) => t.codespaceName)).toEqual(['a', 'b']);
    db.close();
  });

  it('removes a tab without affecting the others', () => {
    const db = openDatabase(':memory:');
    const a = db.addCodespaceTab({ codespaceName: 'a', displayName: 'A', repository: 'me/a', webUrl: 'https://a.github.dev' });
    const b = db.addCodespaceTab({ codespaceName: 'b', displayName: 'B', repository: 'me/b', webUrl: 'https://b.github.dev' });

    db.removeCodespaceTab(a.id);

    const tabs = db.listCodespaceTabs();
    expect(tabs.map((t) => t.id)).toEqual([b.id]);
    db.close();
  });

  it('persists tabs and settings across reopening the same database file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'copilot-desktop-db-test-'));
    const file = join(dir, 'test.db');
    try {
      const db1 = openDatabase(file);
      db1.setSetting('theme', 'github-dark');
      db1.addCodespaceTab({ codespaceName: 'a', displayName: 'A', repository: 'me/a', webUrl: 'https://a.github.dev' });
      db1.close();

      const db2 = openDatabase(file);
      expect(db2.getSetting('theme')).toBe('github-dark');
      expect(db2.listCodespaceTabs()).toHaveLength(1);
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

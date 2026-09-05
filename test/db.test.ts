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

  it('adds tabs in increasing position order', () => {
    const db = openDatabase(':memory:');
    const a = db.addTab({ url: 'https://a.github.dev', title: 'A' });
    const b = db.addTab({ url: 'https://b.github.dev', title: 'B' });

    expect(a.position).toBe(0);
    expect(b.position).toBe(1);

    const tabs = db.listTabs();
    expect(tabs.map((t) => t.title)).toEqual(['A', 'B']);
    db.close();
  });

  it('removes a tab without affecting the others', () => {
    const db = openDatabase(':memory:');
    const a = db.addTab({ url: 'https://a.github.dev', title: 'A' });
    const b = db.addTab({ url: 'https://b.github.dev', title: 'B' });

    db.removeTab(a.id);

    const tabs = db.listTabs();
    expect(tabs.map((t) => t.id)).toEqual([b.id]);
    db.close();
  });

  it('updates a tab url/title as it navigates', () => {
    const db = openDatabase(':memory:');
    const a = db.addTab({ url: 'https://github.com/codespaces', title: 'GitHub' });
    db.updateTab(a.id, { url: 'https://a.github.dev', title: 'my-codespace' });

    const [tab] = db.listTabs();
    expect(tab.url).toBe('https://a.github.dev');
    expect(tab.title).toBe('my-codespace');
    db.close();
  });

  it('persists tabs and settings across reopening the same database file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'copilot-desktop-db-test-'));
    const file = join(dir, 'test.db');
    try {
      const db1 = openDatabase(file);
      db1.setSetting('theme', 'github-dark');
      db1.addTab({ url: 'https://a.github.dev', title: 'A' });
      db1.close();

      const db2 = openDatabase(file);
      expect(db2.getSetting('theme')).toBe('github-dark');
      expect(db2.listTabs()).toHaveLength(1);
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

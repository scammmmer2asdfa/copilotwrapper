import Database from 'better-sqlite3';

export interface CodespaceTabRow {
  id: number;
  codespaceName: string;
  displayName: string;
  repository: string;
  webUrl: string;
  position: number;
  createdAt: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS codespace_tabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codespace_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  repository TEXT NOT NULL,
  web_url TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`;

function toTabRow(r: {
  id: number;
  codespace_name: string;
  display_name: string;
  repository: string;
  web_url: string;
  position: number;
  created_at: number;
}): CodespaceTabRow {
  return {
    id: r.id,
    codespaceName: r.codespace_name,
    displayName: r.display_name,
    repository: r.repository,
    webUrl: r.web_url,
    position: r.position,
    createdAt: r.created_at
  };
}

export class AppDatabase {
  constructor(public readonly raw: Database.Database) {}

  getSetting(key: string): string | undefined {
    const row = this.raw.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.raw
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  allSettings(): Record<string, string> {
    const rows = this.raw.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  /** Open codespace tabs, restored across restarts, in the order they were opened. */
  listCodespaceTabs(): CodespaceTabRow[] {
    const rows = this.raw
      .prepare('SELECT * FROM codespace_tabs ORDER BY position ASC')
      .all() as Parameters<typeof toTabRow>[0][];
    return rows.map(toTabRow);
  }

  addCodespaceTab(tab: { codespaceName: string; displayName: string; repository: string; webUrl: string }): CodespaceTabRow {
    const now = Date.now();
    const maxPos = this.raw.prepare('SELECT MAX(position) as p FROM codespace_tabs').get() as { p: number | null };
    const position = (maxPos.p ?? -1) + 1;
    const info = this.raw
      .prepare(
        'INSERT INTO codespace_tabs (codespace_name, display_name, repository, web_url, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(tab.codespaceName, tab.displayName, tab.repository, tab.webUrl, position, now);
    return {
      id: Number(info.lastInsertRowid),
      codespaceName: tab.codespaceName,
      displayName: tab.displayName,
      repository: tab.repository,
      webUrl: tab.webUrl,
      position,
      createdAt: now
    };
  }

  removeCodespaceTab(id: number): void {
    this.raw.prepare('DELETE FROM codespace_tabs WHERE id = ?').run(id);
  }

  close(): void {
    this.raw.close();
  }
}

/**
 * Opens (or creates) the app database. `file` is injectable so this is
 * testable without Electron — pass ':memory:' or a temp file path in tests.
 */
export function openDatabase(file = ':memory:'): AppDatabase {
  const raw = new Database(file);
  raw.pragma('journal_mode = WAL');
  raw.exec(SCHEMA);
  return new AppDatabase(raw);
}

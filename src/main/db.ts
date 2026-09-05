import Database from 'better-sqlite3';

export interface TabRow {
  id: number;
  url: string;
  title: string;
  position: number;
  createdAt: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`;

function toTabRow(r: { id: number; url: string; title: string; position: number; created_at: number }): TabRow {
  return { id: r.id, url: r.url, title: r.title, position: r.position, createdAt: r.created_at };
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

  /** Open tabs, restored across restarts, in the order they were opened. */
  listTabs(): TabRow[] {
    const rows = this.raw.prepare('SELECT * FROM tabs ORDER BY position ASC').all() as Parameters<typeof toTabRow>[0][];
    return rows.map(toTabRow);
  }

  addTab(tab: { url: string; title: string }): TabRow {
    const now = Date.now();
    const maxPos = this.raw.prepare('SELECT MAX(position) as p FROM tabs').get() as { p: number | null };
    const position = (maxPos.p ?? -1) + 1;
    const info = this.raw
      .prepare('INSERT INTO tabs (url, title, position, created_at) VALUES (?, ?, ?, ?)')
      .run(tab.url, tab.title, position, now);
    return { id: Number(info.lastInsertRowid), url: tab.url, title: tab.title, position, createdAt: now };
  }

  /** Called as the user navigates within a tab's webview, so relaunching resumes where they left off. */
  updateTab(id: number, tab: { url?: string; title?: string }): void {
    if (tab.url !== undefined) this.raw.prepare('UPDATE tabs SET url = ? WHERE id = ?').run(tab.url, id);
    if (tab.title !== undefined) this.raw.prepare('UPDATE tabs SET title = ? WHERE id = ?').run(tab.title, id);
  }

  removeTab(id: number): void {
    this.raw.prepare('DELETE FROM tabs WHERE id = ?').run(id);
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

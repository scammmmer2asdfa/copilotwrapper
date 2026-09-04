import Database from 'better-sqlite3';

export type QueueStatus = 'queued' | 'sending' | 'sent' | 'failed';

export interface SessionRow {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRow {
  id: number;
  sessionId: string;
  role: string;
  content: string;
  createdAt: number;
}

export interface QueueItem {
  id: number;
  sessionId: string;
  content: string;
  status: QueueStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  cwd TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id, id);
CREATE INDEX IF NOT EXISTS idx_queue_session_status ON queue (session_id, status, id);
`;

function toSessionRow(r: {
  id: string;
  title: string;
  cwd: string;
  created_at: number;
  updated_at: number;
}): SessionRow {
  return { id: r.id, title: r.title, cwd: r.cwd, createdAt: r.created_at, updatedAt: r.updated_at };
}

function toMessageRow(r: {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: number;
}): MessageRow {
  return { id: r.id, sessionId: r.session_id, role: r.role, content: r.content, createdAt: r.created_at };
}

function toQueueItem(r: {
  id: number;
  session_id: string;
  content: string;
  status: QueueStatus;
  error: string | null;
  created_at: number;
  updated_at: number;
}): QueueItem {
  return {
    id: r.id,
    sessionId: r.session_id,
    content: r.content,
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export class AppDatabase {
  constructor(public readonly raw: Database.Database) {}

  createSession(session: { id: string; cwd: string; title?: string }): SessionRow {
    const now = Date.now();
    this.raw
      .prepare(
        'INSERT INTO sessions (id, title, cwd, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(session.id, session.title ?? 'New session', session.cwd, now, now);
    return { id: session.id, title: session.title ?? 'New session', cwd: session.cwd, createdAt: now, updatedAt: now };
  }

  listSessions(): SessionRow[] {
    const rows = this.raw.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Parameters<
      typeof toSessionRow
    >[0][];
    return rows.map(toSessionRow);
  }

  touchSession(id: string): void {
    this.raw.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), id);
  }

  renameSession(id: string, title: string): void {
    this.raw.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(title, Date.now(), id);
  }

  deleteSession(id: string): void {
    const tx = this.raw.transaction((sid: string) => {
      this.raw.prepare('DELETE FROM messages WHERE session_id = ?').run(sid);
      this.raw.prepare('DELETE FROM queue WHERE session_id = ?').run(sid);
      this.raw.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
    });
    tx(id);
  }

  addMessage(sessionId: string, role: string, content: string): MessageRow {
    const now = Date.now();
    const info = this.raw
      .prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)')
      .run(sessionId, role, content, now);
    this.touchSession(sessionId);
    return { id: Number(info.lastInsertRowid), sessionId, role, content, createdAt: now };
  }

  listMessages(sessionId: string): MessageRow[] {
    const rows = this.raw
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC')
      .all(sessionId) as Parameters<typeof toMessageRow>[0][];
    return rows.map(toMessageRow);
  }

  /** Adds a message to the per-session send queue, status 'queued'. */
  enqueue(sessionId: string, content: string): QueueItem {
    const now = Date.now();
    const info = this.raw
      .prepare('INSERT INTO queue (session_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(sessionId, content, 'queued', now, now);
    return {
      id: Number(info.lastInsertRowid),
      sessionId,
      content,
      status: 'queued',
      error: null,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Atomically claims the oldest queued item for a session, marking it
   * 'sending'. Returns undefined if nothing is queued. Failed items are
   * never returned, so they don't block items behind them.
   */
  dequeueNext(sessionId: string): QueueItem | undefined {
    const tx = this.raw.transaction((sid: string): QueueItem | undefined => {
      const row = this.raw
        .prepare(
          "SELECT * FROM queue WHERE session_id = ? AND status = 'queued' ORDER BY id ASC LIMIT 1"
        )
        .get(sid) as Parameters<typeof toQueueItem>[0] | undefined;
      if (!row) return undefined;
      const now = Date.now();
      this.raw.prepare("UPDATE queue SET status = 'sending', updated_at = ? WHERE id = ?").run(now, row.id);
      return toQueueItem({ ...row, status: 'sending', updated_at: now });
    });
    return tx(sessionId);
  }

  markQueueSent(id: number): void {
    this.raw.prepare("UPDATE queue SET status = 'sent', updated_at = ? WHERE id = ?").run(Date.now(), id);
  }

  markQueueFailed(id: number, error: string): void {
    this.raw
      .prepare("UPDATE queue SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
      .run(error, Date.now(), id);
  }

  listQueue(sessionId: string): QueueItem[] {
    const rows = this.raw
      .prepare('SELECT * FROM queue WHERE session_id = ? ORDER BY id ASC')
      .all(sessionId) as Parameters<typeof toQueueItem>[0][];
    return rows.map(toQueueItem);
  }

  /** Count of items still waiting to be sent (queued or currently sending). */
  queueDepth(sessionId: string): number {
    const row = this.raw
      .prepare("SELECT COUNT(*) as n FROM queue WHERE session_id = ? AND status IN ('queued', 'sending')")
      .get(sessionId) as { n: number };
    return row.n;
  }

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

  close(): void {
    this.raw.close();
  }
}

/**
 * Opens (or creates) the app database. `file` is injectable so this is
 * testable without Electron — pass ':memory:' or a temp file path in tests.
 * Any queue item left 'sending' from a previous process (a crash mid-send)
 * is reset to 'queued' so it is retried rather than lost.
 */
export function openDatabase(file = ':memory:'): AppDatabase {
  const raw = new Database(file);
  raw.pragma('journal_mode = WAL');
  raw.exec(SCHEMA);
  raw.prepare("UPDATE queue SET status = 'queued', updated_at = ? WHERE status = 'sending'").run(Date.now());
  return new AppDatabase(raw);
}

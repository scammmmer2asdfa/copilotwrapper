import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/main/db.js';

function tempDbFile(): { file: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'copilot-desktop-test-'));
  const file = join(dir, 'test.db');
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('queue', () => {
  it('dispatches queued items in FIFO order', () => {
    const db = openDatabase(':memory:');
    db.createSession({ id: 's1', cwd: '/tmp' });
    db.enqueue('s1', 'first');
    db.enqueue('s1', 'second');
    db.enqueue('s1', 'third');

    const first = db.dequeueNext('s1');
    const second = db.dequeueNext('s1');
    const third = db.dequeueNext('s1');

    expect(first?.content).toBe('first');
    expect(second?.content).toBe('second');
    expect(third?.content).toBe('third');
    expect(db.dequeueNext('s1')).toBeUndefined();
    db.close();
  });

  it('isolates queues per session', () => {
    const db = openDatabase(':memory:');
    db.createSession({ id: 'a', cwd: '/tmp' });
    db.createSession({ id: 'b', cwd: '/tmp' });
    db.enqueue('a', 'for-a');
    db.enqueue('b', 'for-b');

    expect(db.dequeueNext('a')?.content).toBe('for-a');
    expect(db.dequeueNext('b')?.content).toBe('for-b');
    expect(db.dequeueNext('a')).toBeUndefined();
    expect(db.dequeueNext('b')).toBeUndefined();
    db.close();
  });

  it('does not let a failed item block items behind it', () => {
    const db = openDatabase(':memory:');
    db.createSession({ id: 's1', cwd: '/tmp' });
    db.enqueue('s1', 'bad');
    db.enqueue('s1', 'good');

    const bad = db.dequeueNext('s1')!;
    db.markQueueFailed(bad.id, 'boom');

    const good = db.dequeueNext('s1');
    expect(good?.content).toBe('good');
    db.close();
  });

  it('a message marked "sending" is reset to "queued" when the db reopens', () => {
    const { file, cleanup } = tempDbFile();
    try {
      const db1 = openDatabase(file);
      db1.createSession({ id: 's1', cwd: '/tmp' });
      db1.enqueue('s1', 'in-flight');
      const claimed = db1.dequeueNext('s1')!;
      expect(claimed.status).toBe('sending');
      db1.close();

      // Simulate a crash mid-send: reopening must not lose the message.
      const db2 = openDatabase(file);
      const requeued = db2.dequeueNext('s1');
      expect(requeued?.content).toBe('in-flight');
      expect(requeued?.status).toBe('sending');
      db2.close();
    } finally {
      cleanup();
    }
  });

  it('reports queue depth counting only queued and sending items', () => {
    const db = openDatabase(':memory:');
    db.createSession({ id: 's1', cwd: '/tmp' });
    db.enqueue('s1', 'one');
    db.enqueue('s1', 'two');
    expect(db.queueDepth('s1')).toBe(2);

    const item = db.dequeueNext('s1')!;
    expect(db.queueDepth('s1')).toBe(2);

    db.markQueueSent(item.id);
    expect(db.queueDepth('s1')).toBe(1);
    db.close();
  });

  it('persists messages independently of the queue', () => {
    const db = openDatabase(':memory:');
    db.createSession({ id: 's1', cwd: '/tmp' });
    db.addMessage('s1', 'user', 'hello');
    db.addMessage('s1', 'assistant', 'hi there');

    const messages = db.listMessages('s1');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].content).toBe('hi there');
    db.close();
  });
});

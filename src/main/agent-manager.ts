import { EventEmitter } from 'node:events';
import { AcpClient } from './acp-client.js';
import type {
  InitializeResult,
  RequestPermissionParams,
  RequestPermissionResult,
  SessionUpdateParams
} from './acp-protocol.js';
import { AppDatabase, type QueueItem } from './db.js';

export interface AgentManagerEvents {
  'connect-state': (state: ConnectState) => void;
  'session-update': (params: SessionUpdateParams) => void;
  'request-permission': (
    params: RequestPermissionParams,
    respond: (result: RequestPermissionResult) => void
  ) => void;
  'queue-depth': (sessionId: string, depth: number) => void;
  stderr: (chunk: string) => void;
}

export type ConnectState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Owns the single `copilot --acp` subprocess and the per-session send queue.
 * A message sent while a turn is already in flight for its session is
 * enqueued in SQLite rather than interrupting the current prompt; queued
 * messages are dispatched one at a time, in order, once the turn completes.
 */
export class AgentManager extends EventEmitter {
  private client: AcpClient | null = null;
  private connectState: ConnectState = 'disconnected';
  private initResult: InitializeResult | null = null;
  /** sessionId -> true while a session/prompt call is in flight */
  private busy = new Map<string, boolean>();

  constructor(
    private readonly db: AppDatabase,
    private readonly binPath: string,
    private readonly cwd: string
  ) {
    super();
  }

  getConnectState(): ConnectState {
    return this.connectState;
  }

  getInitResult(): InitializeResult | null {
    return this.initResult;
  }

  async start(): Promise<InitializeResult> {
    this.setState('connecting');
    const client = new AcpClient();
    this.client = client;

    client.on('session-update', (params: SessionUpdateParams) => {
      this.emit('session-update', params);
    });
    client.on('request-permission', (params, respond) => {
      this.emit('request-permission', params, respond);
    });
    client.on('stderr', (chunk: string) => this.emit('stderr', chunk));
    client.on('exit', () => {
      this.client = null;
      this.busy.clear();
      this.setState('disconnected');
    });

    client.spawn(this.binPath, ['--acp'], this.cwd);

    try {
      const result = await client.initialize();
      this.initResult = result;
      this.setState('connected');
      return result;
    } catch (err) {
      this.setState('error');
      throw err;
    }
  }

  stop(): void {
    this.client?.kill();
    this.client = null;
    this.busy.clear();
    this.setState('disconnected');
  }

  private setState(state: ConnectState): void {
    this.connectState = state;
    this.emit('connect-state', state);
  }

  private requireClient(): AcpClient {
    if (!this.client || !this.client.isAlive()) throw new Error('agent is not connected');
    return this.client;
  }

  async newSession(cwd: string): Promise<{ sessionId: string; modes: unknown; configOptions: unknown }> {
    const client = this.requireClient();
    const result = await client.newSession(cwd);
    this.db.createSession({ id: result.sessionId, cwd });
    return { sessionId: result.sessionId, modes: result.modes, configOptions: result.configOptions };
  }

  /**
   * Sends a user message for a session. If the session's turn is already in
   * flight, the message is queued in SQLite instead and will be dispatched
   * once the current turn finishes (see `drainQueue`).
   */
  async send(sessionId: string, text: string): Promise<void> {
    this.db.addMessage(sessionId, 'user', text);

    if (this.busy.get(sessionId)) {
      this.db.enqueue(sessionId, text);
      this.emitQueueDepth(sessionId);
      return;
    }

    await this.dispatch(sessionId, text);
    await this.drainQueue(sessionId);
  }

  private async dispatch(sessionId: string, text: string): Promise<void> {
    const client = this.requireClient();
    this.busy.set(sessionId, true);
    try {
      await client.prompt(sessionId, [{ type: 'text', text }]);
    } finally {
      this.busy.set(sessionId, false);
    }
  }

  /** Dispatches queued messages for a session, one at a time, in order. */
  private async drainQueue(sessionId: string): Promise<void> {
    let item: QueueItem | undefined;
    while ((item = this.db.dequeueNext(sessionId))) {
      this.emitQueueDepth(sessionId);
      try {
        await this.dispatch(item.sessionId, item.content);
        this.db.markQueueSent(item.id);
      } catch (err) {
        this.db.markQueueFailed(item.id, err instanceof Error ? err.message : String(err));
      }
      this.emitQueueDepth(sessionId);
    }
  }

  private emitQueueDepth(sessionId: string): void {
    this.emit('queue-depth', sessionId, this.db.queueDepth(sessionId));
  }

  cancel(sessionId: string): void {
    this.requireClient().cancel(sessionId);
  }

  setMode(sessionId: string, modeId: string): Promise<unknown> {
    return this.requireClient().setMode(sessionId, modeId);
  }
}

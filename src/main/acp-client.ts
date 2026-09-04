import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import type {
  InitializeResult,
  JsonRpcFailure,
  JsonRpcInbound,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcSuccess,
  NewSessionResult,
  PromptResult,
  RequestPermissionParams,
  RequestPermissionResult,
  SessionUpdateParams
} from './acp-protocol.js';

function isRequest(msg: JsonRpcInbound): msg is JsonRpcRequest {
  return 'method' in msg && 'id' in msg && msg.id !== undefined;
}

function isNotification(msg: JsonRpcInbound): msg is JsonRpcNotification {
  return 'method' in msg && !('id' in msg && msg.id !== undefined);
}

function isSuccess(msg: JsonRpcInbound): msg is JsonRpcSuccess {
  return 'result' in msg;
}

function isFailure(msg: JsonRpcInbound): msg is JsonRpcFailure {
  return 'error' in msg;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export interface AcpClientEvents {
  'session-update': (params: SessionUpdateParams) => void;
  'request-permission': (
    params: RequestPermissionParams,
    respond: (result: RequestPermissionResult) => void
  ) => void;
  exit: (code: number | null) => void;
  stderr: (chunk: string) => void;
}

/**
 * JSON-RPC client for the ACP server exposed by `copilot --acp`. Speaks
 * newline-delimited JSON over the subprocess's stdio.
 */
export class AcpClient extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private buffer = '';

  spawn(binPath: string, args: string[], cwd: string): void {
    this.child = spawn(binPath, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    this.child.stdout.on('data', (chunk: Buffer) => this.onStdout(chunk));
    this.child.stderr.on('data', (chunk: Buffer) => this.emit('stderr', chunk.toString('utf8')));
    this.child.on('exit', (code) => {
      this.rejectAllPending(new Error('agent process exited'));
      this.emit('exit', code);
    });
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  isAlive(): boolean {
    return !!this.child && this.child.exitCode === null && !this.child.killed;
  }

  kill(): void {
    this.child?.kill();
  }

  private onStdout(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (!line.trim()) continue;
      let msg: JsonRpcInbound;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      this.handleMessage(msg);
    }
  }

  private handleMessage(msg: JsonRpcInbound): void {
    if (isSuccess(msg) || isFailure(msg)) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (isFailure(msg)) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (isRequest(msg)) {
      this.handleInboundRequest(msg);
      return;
    }

    if (isNotification(msg)) {
      this.handleNotification(msg);
    }
  }

  private handleNotification(msg: JsonRpcNotification): void {
    if (msg.method === 'session/update') {
      this.emit('session-update', msg.params as SessionUpdateParams);
    }
  }

  private handleInboundRequest(msg: JsonRpcRequest): void {
    if (msg.method === 'session/request_permission') {
      const params = msg.params as RequestPermissionParams;
      this.emit('request-permission', params, (result: RequestPermissionResult) => {
        this.sendResult(msg.id, result);
      });
      return;
    }

    if (msg.method === 'fs/read_text_file') {
      const params = msg.params as { path: string };
      readFile(params.path, 'utf8')
        .then((content) => this.sendResult(msg.id, { content }))
        .catch((err: Error) => this.sendError(msg.id, err.message));
      return;
    }

    if (msg.method === 'fs/write_text_file') {
      const params = msg.params as { path: string; content: string };
      writeFile(params.path, params.content, 'utf8')
        .then(() => this.sendResult(msg.id, {}))
        .catch((err: Error) => this.sendError(msg.id, err.message));
      return;
    }

    this.sendError(msg.id, `Unhandled method: ${msg.method}`, -32601);
  }

  private sendResult(id: number, result: unknown): void {
    this.writeLine({ jsonrpc: '2.0', id, result });
  }

  private sendError(id: number, message: string, code = -32000): void {
    this.writeLine({ jsonrpc: '2.0', id, error: { code, message } });
  }

  private writeLine(obj: unknown): void {
    if (!this.child) throw new Error('agent process not started');
    this.child.stdin.write(JSON.stringify(obj) + '\n');
  }

  private request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.child) return Promise.reject(new Error('agent process not started'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.writeLine({ jsonrpc: '2.0', id, method, params });
    });
  }

  private notify(method: string, params?: unknown): void {
    this.writeLine({ jsonrpc: '2.0', method, params });
  }

  private rejectAllPending(err: Error): void {
    for (const { reject } of this.pending.values()) reject(err);
    this.pending.clear();
  }

  initialize(): Promise<InitializeResult> {
    return this.request<InitializeResult>('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true }
      }
    });
  }

  newSession(cwd: string, mcpServers: unknown[] = []): Promise<NewSessionResult> {
    return this.request<NewSessionResult>('session/new', { cwd, mcpServers });
  }

  prompt(sessionId: string, promptBlocks: unknown[]): Promise<PromptResult> {
    return this.request<PromptResult>('session/prompt', { sessionId, prompt: promptBlocks });
  }

  cancel(sessionId: string): void {
    this.notify('session/cancel', { sessionId });
  }

  setMode(sessionId: string, modeId: string): Promise<unknown> {
    return this.request('session/set_mode', { sessionId, modeId });
  }
}

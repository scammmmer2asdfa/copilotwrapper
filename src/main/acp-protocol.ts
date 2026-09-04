/**
 * Minimal type surface for the Agent Client Protocol (ACP) as implemented by
 * the `copilot --acp` subprocess. Only the shapes this app actually sends or
 * receives are modeled — this is not a full ACP SDK.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: number;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcInbound = JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcFailure;

export interface TerminalAuthMeta {
  command: string;
  args: string[];
  label: string;
}

export interface AuthMethod {
  id: string;
  name: string;
  description?: string;
  _meta?: { 'terminal-auth'?: TerminalAuthMeta };
}

export interface InitializeResult {
  protocolVersion: number;
  agentCapabilities: {
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
    sessionCapabilities?: Record<string, unknown>;
  };
  agentInfo: { name: string; title: string; version: string };
  authMethods: AuthMethod[];
}

export interface SessionMode {
  id: string;
  name: string;
  description?: string;
}

export interface NewSessionResult {
  sessionId: string;
  modes?: {
    availableModes: SessionMode[];
    currentModeId: string;
  };
  configOptions?: unknown[];
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: unknown };

export interface PlanEntry {
  content: string;
  priority?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ToolCallUpdate {
  toolCallId: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  title?: string;
  kind?: string;
  content?: unknown;
  locations?: { path: string; line?: number }[];
}

export type SessionUpdate =
  | { sessionUpdate: 'agent_message_chunk'; content: ContentBlock }
  | { sessionUpdate: 'agent_thought_chunk'; content: ContentBlock }
  | { sessionUpdate: 'plan'; entries: PlanEntry[] }
  | ({ sessionUpdate: 'tool_call' } & ToolCallUpdate)
  | ({ sessionUpdate: 'tool_call_update' } & ToolCallUpdate)
  | { sessionUpdate: string; [key: string]: unknown };

export interface SessionUpdateParams {
  sessionId: string;
  update: SessionUpdate;
}

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' | string;
}

export interface RequestPermissionParams {
  sessionId: string;
  toolCall: ToolCallUpdate;
  options: PermissionOption[];
}

export interface RequestPermissionResult {
  outcome:
    | { outcome: 'selected'; optionId: string }
    | { outcome: 'cancelled' };
}

export interface PromptResult {
  stopReason: string;
}

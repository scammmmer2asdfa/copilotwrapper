/**
 * Shared IPC contract between main, preload, and renderer. Keeping channel
 * names and payload shapes here means the three processes can't drift apart.
 */

export const IPC = {
  agentStart: 'agent:start',
  agentStop: 'agent:stop',
  agentConnectState: 'agent:connect-state',
  agentStderr: 'agent:stderr',

  sessionsList: 'sessions:list',
  sessionsNew: 'sessions:new',
  sessionsRename: 'sessions:rename',
  sessionsDelete: 'sessions:delete',
  sessionsMessages: 'sessions:messages',

  chatSend: 'chat:send',
  chatCancel: 'chat:cancel',
  chatSetMode: 'chat:set-mode',
  chatSessionUpdate: 'chat:session-update',
  chatQueueDepth: 'chat:queue-depth',
  chatRequestPermission: 'chat:request-permission',
  chatPermissionResponse: 'chat:permission-response',

  settingsGetAll: 'settings:get-all',
  settingsSet: 'settings:set',

  authStart: 'auth:start',
  authCancel: 'auth:cancel',
  authCode: 'auth:code',
  authDone: 'auth:done',

  filesOpenInEditor: 'files:open-in-editor',
  filesReadInstructions: 'files:read-instructions',
  filesWriteInstructions: 'files:write-instructions',

  dialogChooseDirectory: 'dialog:choose-directory',
  dialogChooseFile: 'dialog:choose-file',

  environmentCheck: 'environment:check',
  environmentInstallCli: 'environment:install-cli',
  environmentInstallOutput: 'environment:install-output',
  environmentInstallDone: 'environment:install-done',

  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit'
} as const;

export interface SessionSummary {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: string;
  content: string;
  createdAt: number;
}

export interface PermissionRequestPayload {
  requestId: string;
  sessionId: string;
  toolCall: {
    toolCallId: string;
    title?: string;
    kind?: string;
  };
  options: { optionId: string; name: string; kind: string }[];
}

export interface PermissionResponsePayload {
  requestId: string;
  optionId: string | null;
}

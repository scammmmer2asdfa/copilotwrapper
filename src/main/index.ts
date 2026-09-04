import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { openDatabase, type AppDatabase } from './db.js';
import { locateCli, locateSystemCli } from './cli-locator.js';
import { AgentManager } from './agent-manager.js';
import { AuthRunner } from './auth.js';
import { openInEditor, type EditorConfig } from './editor.js';
import { checkEnvironment, CliInstaller } from './environment-check.js';
import { TerminalManager } from './terminal-manager.js';
import { IPC, type PermissionRequestPayload, type PermissionResponsePayload } from '../shared/ipc.js';
import type { RequestPermissionParams, RequestPermissionResult } from './acp-protocol.js';

let mainWindow: BrowserWindow | null = null;
let db: AppDatabase;
let agent: AgentManager;
let agentBinPath: string | null = null;
const authRunner = new AuthRunner();
const cliInstaller = new CliInstaller();
const terminals = new TerminalManager();
const pendingPermissions = new Map<string, (result: RequestPermissionResult) => void>();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      // electron-vite emits the preload bundle as .mjs (package.json's
      // "type": "module" would otherwise make Node treat a plain .js
      // preload as ESM inconsistently with how Electron loads it).
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function send(channel: string, ...args: unknown[]): void {
  mainWindow?.webContents.send(channel, ...args);
}

function wireAgentEvents(): void {
  agent.on('connect-state', (state) => send(IPC.agentConnectState, state));
  agent.on('stderr', (chunk) => send(IPC.agentStderr, chunk));
  agent.on('session-update', (params) => send(IPC.chatSessionUpdate, params));
  agent.on('queue-depth', (sessionId, depth) => send(IPC.chatQueueDepth, sessionId, depth));
  agent.on('request-permission', (params: RequestPermissionParams, respond: (result: RequestPermissionResult) => void) => {
    const requestId = randomUUID();
    pendingPermissions.set(requestId, respond);
    const payload: PermissionRequestPayload = {
      requestId,
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: params.toolCall.toolCallId,
        title: params.toolCall.title,
        kind: params.toolCall.kind
      },
      options: params.options.map((o) => ({ optionId: o.optionId, name: o.name, kind: o.kind }))
    };
    send(IPC.chatRequestPermission, payload);
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.agentStart, async (_e, cwd: string) => {
    const binPath = locateCli({
      resourcesPath: process.resourcesPath,
      appRoot: app.getAppPath(),
      overridePath: db.getSetting('cliPath') || undefined
    });
    if (!agent || agentBinPath !== binPath) {
      agent?.stop();
      agent = new AgentManager(db, binPath, cwd);
      agentBinPath = binPath;
      wireAgentEvents();
    }
    return agent.start();
  });

  ipcMain.handle(IPC.agentStop, async () => {
    agent?.stop();
  });

  ipcMain.handle(IPC.sessionsList, async () => db.listSessions());

  ipcMain.handle(IPC.sessionsNew, async (_e, cwd: string) => agent.newSession(cwd));

  ipcMain.handle(IPC.sessionsRename, async (_e, id: string, title: string) => db.renameSession(id, title));

  ipcMain.handle(IPC.sessionsDelete, async (_e, id: string) => db.deleteSession(id));

  ipcMain.handle(IPC.sessionsMessages, async (_e, sessionId: string) => db.listMessages(sessionId));

  ipcMain.handle(IPC.chatSend, async (_e, sessionId: string, text: string) => agent.send(sessionId, text));

  ipcMain.handle(IPC.chatCancel, async (_e, sessionId: string) => agent.cancel(sessionId));

  ipcMain.handle(IPC.chatSetMode, async (_e, sessionId: string, modeId: string) => agent.setMode(sessionId, modeId));

  ipcMain.on(IPC.chatPermissionResponse, (_e, payload: PermissionResponsePayload) => {
    const respond = pendingPermissions.get(payload.requestId);
    if (!respond) return;
    pendingPermissions.delete(payload.requestId);
    respond(
      payload.optionId
        ? { outcome: { outcome: 'selected', optionId: payload.optionId } }
        : { outcome: { outcome: 'cancelled' } }
    );
  });

  ipcMain.handle(IPC.settingsGetAll, async () => db.allSettings());

  ipcMain.handle(IPC.settingsSet, async (_e, key: string, value: string) => db.setSetting(key, value));

  ipcMain.handle(IPC.authStart, async () => {
    const initResult = agent?.getInitResult();
    const meta = initResult?.authMethods?.[0]?._meta?.['terminal-auth'];
    if (!meta) throw new Error('no terminal-auth method available; connect to the agent first');
    authRunner.run(meta);
  });

  ipcMain.handle(IPC.authCancel, async () => authRunner.cancel());

  authRunner.on('code', (info) => send(IPC.authCode, info));
  authRunner.on('done', (success) => send(IPC.authDone, success));

  ipcMain.handle(IPC.filesOpenInEditor, async (_e, config: EditorConfig, filePath: string, line?: number) =>
    openInEditor(config, filePath, line)
  );

  ipcMain.handle(IPC.dialogChooseDirectory, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.dialogChooseFile, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.environmentCheck, async () => {
    const bundledCliPath = locateCli({ resourcesPath: process.resourcesPath, appRoot: app.getAppPath() });
    return checkEnvironment(bundledCliPath, locateSystemCli());
  });

  ipcMain.handle(IPC.environmentInstallCli, async () => cliInstaller.run());
  cliInstaller.on('output', (chunk) => send(IPC.environmentInstallOutput, chunk));
  cliInstaller.on('done', (success) => send(IPC.environmentInstallDone, success));

  const instructionsPath = (cwd: string) => join(cwd, '.github', 'copilot-instructions.md');

  ipcMain.handle(IPC.filesReadInstructions, async (_e, cwd: string) => {
    try {
      return await readFile(instructionsPath(cwd), 'utf8');
    } catch {
      return '';
    }
  });

  ipcMain.handle(IPC.filesWriteInstructions, async (_e, cwd: string, content: string) => {
    await mkdir(join(cwd, '.github'), { recursive: true });
    await writeFile(instructionsPath(cwd), content, 'utf8');
  });

  ipcMain.handle(IPC.terminalCreate, async (_e, id: string, cwd: string, cols: number, rows: number) =>
    terminals.create(id, cwd, cols, rows)
  );
  ipcMain.on(IPC.terminalWrite, (_e, id: string, data: string) => terminals.write(id, data));
  ipcMain.on(IPC.terminalResize, (_e, id: string, cols: number, rows: number) => terminals.resize(id, cols, rows));
  ipcMain.on(IPC.terminalKill, (_e, id: string) => terminals.kill(id));
  terminals.on('data', (id, chunk) => send(IPC.terminalData, id, chunk));
  terminals.on('exit', (id, code) => send(IPC.terminalExit, id, code));
}

app.whenReady().then(() => {
  db = openDatabase(join(app.getPath('userData'), 'copilot-desktop.db'));
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  agent?.stop();
  terminals.killAll();
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

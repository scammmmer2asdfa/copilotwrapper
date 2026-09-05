import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { openDatabase, type AppDatabase } from './db.js';
import { TerminalManager } from './terminal-manager.js';
import { listCodespaces, openCodespace } from './codespaces.js';
import { IPC } from '../shared/ipc.js';

let mainWindow: BrowserWindow | null = null;
let db: AppDatabase;
const terminals = new TerminalManager();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
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
      sandbox: false,
      // The in-app browser view for a codespace's own web editor gets its
      // own isolated webContents with no Node access and no access to our
      // preload API - not the renderer's main webContents.
      webviewTag: true
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

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.settingsGetAll, async () => db.allSettings());
  ipcMain.handle(IPC.settingsSet, async (_e, key: string, value: string) => db.setSetting(key, value));

  ipcMain.handle(IPC.codespacesList, async () => listCodespaces());
  ipcMain.handle(IPC.codespacesOpen, async (_e, name: string) => openCodespace(name));

  ipcMain.handle(IPC.codespaceTabsList, async () => db.listCodespaceTabs());
  ipcMain.handle(
    IPC.codespaceTabsAdd,
    async (_e, tab: { codespaceName: string; displayName: string; repository: string; webUrl: string }) =>
      db.addCodespaceTab(tab)
  );
  ipcMain.handle(IPC.codespaceTabsRemove, async (_e, id: number) => db.removeCodespaceTab(id));

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
  terminals.killAll();
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_e, contents) => {
  // Only intercept new-window attempts from our own renderer's main
  // webContents (e.g. a normal <a target="_blank">) - the codespace
  // <webview>'s own navigation is handled by the webview itself and should
  // not be redirected out to the OS browser.
  if (contents.getType() !== 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
});

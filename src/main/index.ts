import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { openDatabase, type AppDatabase } from './db.js';
import { TerminalManager } from './terminal-manager.js';
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
      // Each tab's <webview> (github.com, a codespace's own editor, etc.)
      // gets its own isolated webContents with no Node access and no
      // access to our preload API - not the renderer's main webContents.
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

  ipcMain.handle(IPC.tabsList, async () => db.listTabs());
  ipcMain.handle(IPC.tabsAdd, async (_e, tab: { url: string; title: string }) => db.addTab(tab));
  ipcMain.handle(IPC.tabsUpdate, async (_e, id: number, tab: { url?: string; title?: string }) => db.updateTab(id, tab));
  ipcMain.handle(IPC.tabsRemove, async (_e, id: number) => db.removeTab(id));

  ipcMain.handle(IPC.terminalCreate, async (_e, id: string, cwd: string, cols: number, rows: number) =>
    terminals.create(id, cwd, cols, rows)
  );
  ipcMain.on(IPC.terminalWrite, (_e, id: string, data: string) => terminals.write(id, data));
  ipcMain.on(IPC.terminalResize, (_e, id: string, cols: number, rows: number) => terminals.resize(id, cols, rows));
  ipcMain.on(IPC.terminalKill, (_e, id: string) => terminals.kill(id));
  terminals.on('data', (id, chunk) => send(IPC.terminalData, id, chunk));
  terminals.on('exit', (id, code) => send(IPC.terminalExit, id, code));

  ipcMain.handle(IPC.shellOpenExternal, async (_e, url: string) => {
    // Only ever hand http(s) URLs to the OS - never file:/custom schemes
    // requested by a compromised renderer.
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
    await shell.openExternal(url);
  });
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
  // webContents (e.g. a normal <a target="_blank">) - each tab's own
  // <webview> handles its own navigation and should not be redirected out
  // to the OS browser.
  if (contents.getType() !== 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
});

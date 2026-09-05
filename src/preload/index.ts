import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CodespaceSummary, type CodespaceTab } from '../shared/ipc.js';

const api = {
  settings: {
    getAll: () => ipcRenderer.invoke(IPC.settingsGetAll) as Promise<Record<string, string>>,
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.settingsSet, key, value)
  },

  codespaces: {
    list: () => ipcRenderer.invoke(IPC.codespacesList) as Promise<CodespaceSummary[]>,
    open: (name: string) => ipcRenderer.invoke(IPC.codespacesOpen, name)
  },

  codespaceTabs: {
    list: () => ipcRenderer.invoke(IPC.codespaceTabsList) as Promise<CodespaceTab[]>,
    add: (tab: { codespaceName: string; displayName: string; repository: string; webUrl: string }) =>
      ipcRenderer.invoke(IPC.codespaceTabsAdd, tab) as Promise<CodespaceTab>,
    remove: (id: number) => ipcRenderer.invoke(IPC.codespaceTabsRemove, id)
  },

  terminal: {
    create: (id: string, cwd: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC.terminalCreate, id, cwd, cols, rows),
    write: (id: string, data: string) => ipcRenderer.send(IPC.terminalWrite, id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.send(IPC.terminalResize, id, cols, rows),
    kill: (id: string) => ipcRenderer.send(IPC.terminalKill, id),
    onData: (cb: (id: string, chunk: string) => void) => {
      const listener = (_e: unknown, id: string, chunk: string) => cb(id, chunk);
      ipcRenderer.on(IPC.terminalData, listener);
      return () => ipcRenderer.removeListener(IPC.terminalData, listener);
    },
    onExit: (cb: (id: string, code: number) => void) => {
      const listener = (_e: unknown, id: string, code: number) => cb(id, code);
      ipcRenderer.on(IPC.terminalExit, listener);
      return () => ipcRenderer.removeListener(IPC.terminalExit, listener);
    }
  }
};

export type CopilotDesktopApi = typeof api;

contextBridge.exposeInMainWorld('copilotDesktop', api);

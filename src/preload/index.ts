import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type Tab } from '../shared/ipc.js';

const api = {
  settings: {
    getAll: () => ipcRenderer.invoke(IPC.settingsGetAll) as Promise<Record<string, string>>,
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.settingsSet, key, value)
  },

  tabs: {
    list: () => ipcRenderer.invoke(IPC.tabsList) as Promise<Tab[]>,
    add: (tab: { url: string; title: string }) => ipcRenderer.invoke(IPC.tabsAdd, tab) as Promise<Tab>,
    update: (id: number, tab: { url?: string; title?: string }) => ipcRenderer.invoke(IPC.tabsUpdate, id, tab),
    remove: (id: number) => ipcRenderer.invoke(IPC.tabsRemove, id)
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(IPC.shellOpenExternal, url) as Promise<void>
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

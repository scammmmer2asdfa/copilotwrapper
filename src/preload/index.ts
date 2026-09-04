import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type PermissionResponsePayload } from '../shared/ipc.js';
import type { EditorConfig } from '../main/editor.js';

const api = {
  agent: {
    start: (cwd: string) => ipcRenderer.invoke(IPC.agentStart, cwd),
    stop: () => ipcRenderer.invoke(IPC.agentStop),
    onConnectState: (cb: (state: string) => void) => {
      const listener = (_e: unknown, state: string) => cb(state);
      ipcRenderer.on(IPC.agentConnectState, listener);
      return () => ipcRenderer.removeListener(IPC.agentConnectState, listener);
    },
    onStderr: (cb: (chunk: string) => void) => {
      const listener = (_e: unknown, chunk: string) => cb(chunk);
      ipcRenderer.on(IPC.agentStderr, listener);
      return () => ipcRenderer.removeListener(IPC.agentStderr, listener);
    }
  },

  sessions: {
    list: () => ipcRenderer.invoke(IPC.sessionsList),
    create: (cwd: string) => ipcRenderer.invoke(IPC.sessionsNew, cwd),
    rename: (id: string, title: string) => ipcRenderer.invoke(IPC.sessionsRename, id, title),
    remove: (id: string) => ipcRenderer.invoke(IPC.sessionsDelete, id),
    messages: (sessionId: string) => ipcRenderer.invoke(IPC.sessionsMessages, sessionId)
  },

  chat: {
    send: (sessionId: string, text: string) => ipcRenderer.invoke(IPC.chatSend, sessionId, text),
    cancel: (sessionId: string) => ipcRenderer.invoke(IPC.chatCancel, sessionId),
    setMode: (sessionId: string, modeId: string) => ipcRenderer.invoke(IPC.chatSetMode, sessionId, modeId),
    onSessionUpdate: (cb: (params: unknown) => void) => {
      const listener = (_e: unknown, params: unknown) => cb(params);
      ipcRenderer.on(IPC.chatSessionUpdate, listener);
      return () => ipcRenderer.removeListener(IPC.chatSessionUpdate, listener);
    },
    onQueueDepth: (cb: (sessionId: string, depth: number) => void) => {
      const listener = (_e: unknown, sessionId: string, depth: number) => cb(sessionId, depth);
      ipcRenderer.on(IPC.chatQueueDepth, listener);
      return () => ipcRenderer.removeListener(IPC.chatQueueDepth, listener);
    },
    onRequestPermission: (cb: (payload: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown) => cb(payload);
      ipcRenderer.on(IPC.chatRequestPermission, listener);
      return () => ipcRenderer.removeListener(IPC.chatRequestPermission, listener);
    },
    respondPermission: (payload: PermissionResponsePayload) =>
      ipcRenderer.send(IPC.chatPermissionResponse, payload)
  },

  settings: {
    getAll: () => ipcRenderer.invoke(IPC.settingsGetAll),
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.settingsSet, key, value)
  },

  auth: {
    start: () => ipcRenderer.invoke(IPC.authStart),
    cancel: () => ipcRenderer.invoke(IPC.authCancel),
    onCode: (cb: (info: { code: string; url?: string }) => void) => {
      const listener = (_e: unknown, info: { code: string; url?: string }) => cb(info);
      ipcRenderer.on(IPC.authCode, listener);
      return () => ipcRenderer.removeListener(IPC.authCode, listener);
    },
    onDone: (cb: (success: boolean) => void) => {
      const listener = (_e: unknown, success: boolean) => cb(success);
      ipcRenderer.on(IPC.authDone, listener);
      return () => ipcRenderer.removeListener(IPC.authDone, listener);
    }
  },

  files: {
    openInEditor: (config: EditorConfig, filePath: string, line?: number) =>
      ipcRenderer.invoke(IPC.filesOpenInEditor, config, filePath, line)
  },

  dialog: {
    chooseDirectory: () => ipcRenderer.invoke(IPC.dialogChooseDirectory),
    chooseFile: () => ipcRenderer.invoke(IPC.dialogChooseFile)
  }
};

export type CopilotDesktopApi = typeof api;

contextBridge.exposeInMainWorld('copilotDesktop', api);

/**
 * Shared IPC contract between main, preload, and renderer. Keeping channel
 * names and payload shapes here means the three processes can't drift apart.
 */

export const IPC = {
  settingsGetAll: 'settings:get-all',
  settingsSet: 'settings:set',

  codespacesList: 'codespaces:list',
  codespacesOpen: 'codespaces:open',

  codespaceTabsList: 'codespace-tabs:list',
  codespaceTabsAdd: 'codespace-tabs:add',
  codespaceTabsRemove: 'codespace-tabs:remove',

  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit'
} as const;

export interface CodespaceSummary {
  name: string;
  displayName: string;
  repository: string;
  state: string;
  lastUsedAt: string;
  webUrl: string;
}

export interface CodespaceTab {
  id: number;
  codespaceName: string;
  displayName: string;
  repository: string;
  webUrl: string;
  position: number;
  createdAt: number;
}

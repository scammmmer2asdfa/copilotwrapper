/**
 * Shared IPC contract between main, preload, and renderer. Keeping channel
 * names and payload shapes here means the three processes can't drift apart.
 */

export const IPC = {
  settingsGetAll: 'settings:get-all',
  settingsSet: 'settings:set',

  tabsList: 'tabs:list',
  tabsAdd: 'tabs:add',
  tabsUpdate: 'tabs:update',
  tabsRemove: 'tabs:remove',

  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit'
} as const;

/** The default landing page for a new tab — signing into github.com here is all the app needs; no CLI required. */
export const DEFAULT_TAB_URL = 'https://github.com/codespaces';

export interface Tab {
  id: number;
  url: string;
  title: string;
  position: number;
  createdAt: number;
}

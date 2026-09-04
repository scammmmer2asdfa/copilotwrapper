import type { CopilotDesktopApi } from '../preload/index';

declare global {
  interface Window {
    copilotDesktop: CopilotDesktopApi;
  }
}

export {};

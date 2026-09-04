import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { TerminalAuthMeta } from './acp-protocol.js';

/** Matches the device-code Copilot prints, e.g. "code: ABCD-1234" or "ABCD-1234". */
const DEVICE_CODE_RE = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/;
const VERIFICATION_URL_RE = /(https?:\/\/\S+)/;

export interface AuthEvents {
  code: (info: { code: string; url?: string }) => void;
  done: (success: boolean) => void;
  output: (chunk: string) => void;
}

/**
 * Runs `copilot login` (the exact command/args come from the ACP
 * `initialize()` result's `authMethods[]._meta['terminal-auth']`) as its own
 * process and scrapes the device code from its stdout/stderr. The CLI owns
 * the actual token exchange; this class never sees or handles a token.
 */
export class AuthRunner extends EventEmitter {
  private child: ReturnType<typeof spawn> | null = null;
  private codeEmitted = false;

  run(meta: TerminalAuthMeta, env: NodeJS.ProcessEnv = process.env): void {
    this.codeEmitted = false;
    // The CLI defaults to a browser-based web flow on a local desktop (only
    // headless/remote environments default to printing a device code) - this
    // app's UI only knows how to show a device code, so force that flow
    // explicitly regardless of platform/environment. Verified against the
    // real CLI: --device-code prints
    // "To authenticate, visit <url> and enter code XXXX-XXXX".
    const args = meta.args.includes('--device-code') ? meta.args : [...meta.args, '--device-code'];
    this.child = spawn(meta.command, args, { stdio: ['ignore', 'pipe', 'pipe'], env });

    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      this.emit('output', text);
      this.scrapeCode(text);
    };

    this.child.stdout?.on('data', onData);
    this.child.stderr?.on('data', onData);
    this.child.on('exit', (code) => {
      this.emit('done', code === 0);
      this.child = null;
    });
  }

  private scrapeCode(text: string): void {
    if (this.codeEmitted) return;
    const codeMatch = text.match(DEVICE_CODE_RE);
    if (!codeMatch) return;
    const urlMatch = text.match(VERIFICATION_URL_RE);
    this.codeEmitted = true;
    this.emit('code', { code: codeMatch[1], url: urlMatch?.[1] });
  }

  cancel(): void {
    this.child?.kill();
    this.child = null;
  }

  isRunning(): boolean {
    return this.child !== null;
  }
}

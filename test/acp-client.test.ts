import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AcpClient } from '../src/main/acp-client.js';
import type { SessionUpdateParams } from '../src/main/acp-protocol.js';

const CLI_PATH = join(process.cwd(), 'resources', 'copilot-cli', 'linux-x64', 'copilot');
const hasCli = existsSync(CLI_PATH);

/**
 * Integration test against the REAL fetched CLI binary. Skipped entirely if
 * `npm run fetch-cli` hasn't been run yet — there is no mock/simulated ACP
 * server here, only the genuine `copilot --acp` process.
 */
describe.skipIf(!hasCli)('AcpClient against the real copilot --acp binary', () => {
  let client: AcpClient;

  beforeAll(() => {
    client = new AcpClient();
    client.spawn(CLI_PATH, ['--acp'], process.cwd());
  });

  afterAll(() => {
    client.kill();
  });

  it('completes the initialize handshake', async () => {
    const result = await client.initialize();
    expect(result.protocolVersion).toBe(1);
    expect(result.agentInfo.name).toBe('Copilot');
    expect(result.authMethods.length).toBeGreaterThan(0);
    expect(result.authMethods[0]._meta?.['terminal-auth']?.args).toContain('login');
  });

  it('creates a new session and receives its id', async () => {
    const result = await client.newSession(process.cwd());
    expect(result.sessionId).toBeTruthy();
    expect(result.modes?.availableModes.length).toBeGreaterThan(0);
  });

  it('receives available_commands_update listing 32 real slash commands', async () => {
    const commands = await new Promise<string[]>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out waiting for available_commands_update')), 8000);
      const onUpdate = (params: SessionUpdateParams) => {
        const update = params.update as { sessionUpdate: string; availableCommands?: { name: string }[] };
        if (update.sessionUpdate === 'available_commands_update' && update.availableCommands) {
          clearTimeout(timeout);
          client.off('session-update', onUpdate);
          resolve(update.availableCommands.map((c) => c.name));
        }
      };
      client.on('session-update', onUpdate);
      client.newSession(process.cwd()).catch(reject);
    });

    expect(commands.length).toBe(32);
    expect(commands).toContain('plan');
    expect(commands).toContain('mcp');
  });
});

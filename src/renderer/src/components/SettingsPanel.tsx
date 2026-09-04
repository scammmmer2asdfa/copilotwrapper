import React, { useEffect, useState } from 'react';
import type { EditorId } from '../../../main/editor';
import { THEMES, type ThemeId } from '../themes';

interface McpServerRow {
  name: string;
  command: string;
}

interface Props {
  editor: EditorId;
  customBinary: string;
  theme: ThemeId;
  mcpServers: McpServerRow[];
  /** Empty string = auto-detect (bundled binary). */
  cliPath: string;
  /** Working directory of the active session, for the agent instructions file. */
  cwd: string;
  onChange: (
    patch: Partial<{
      editor: EditorId;
      customBinary: string;
      theme: ThemeId;
      mcpServers: McpServerRow[];
      cliPath: string;
    }>
  ) => void;
  onClose: () => void;
}

const EDITOR_OPTIONS: { id: EditorId; label: string }[] = [
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'zed', label: 'Zed' },
  { id: 'sublime', label: 'Sublime Text' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'vim', label: 'Vim' },
  { id: 'custom', label: 'Custom binary…' },
  { id: 'system', label: 'OS default' }
];

export function SettingsPanel(props: Props): React.JSX.Element {
  const { editor, customBinary, theme, mcpServers, cliPath, cwd, onChange, onClose } = props;
  const [newServerName, setNewServerName] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('');
  const [instructions, setInstructions] = useState('');
  const [instructionsStatus, setInstructionsStatus] = useState<'idle' | 'loading' | 'saving' | 'saved'>('loading');

  useEffect(() => {
    setInstructionsStatus('loading');
    window.copilotDesktop.files.readInstructions(cwd).then((content: string) => {
      setInstructions(content);
      setInstructionsStatus('idle');
    });
  }, [cwd]);

  return (
    <div className="modal-overlay">
      <div className="modal modal--settings">
        <h3>Settings</h3>

        <section>
          <h4>Copilot CLI location</h4>
          <p className="settings-hint">
            Auto-detect uses the bundled binary. Pointing at a CLI you installed yourself (e.g.
            <code> npm install -g @github/copilot</code>) also avoids macOS's quarantine flag on
            unsigned downloaded apps, since npm-installed binaries never get quarantined.
          </p>
          <div className="settings-cli-path">
            <input
              className="mono"
              placeholder="Auto-detect (bundled)"
              value={cliPath}
              onChange={(e) => onChange({ cliPath: e.target.value })}
            />
            <button
              onClick={async () => {
                const picked = await window.copilotDesktop.dialog.chooseFile();
                if (picked) onChange({ cliPath: picked });
              }}
            >
              Browse…
            </button>
            {cliPath && <button onClick={() => onChange({ cliPath: '' })}>Reset</button>}
          </div>
        </section>

        <section>
          <h4>Editor</h4>
          <select aria-label="Editor" value={editor} onChange={(e) => onChange({ editor: e.target.value as EditorId })}>
            {EDITOR_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {editor === 'custom' && (
            <input
              placeholder="/path/to/binary"
              value={customBinary}
              onChange={(e) => onChange({ customBinary: e.target.value })}
            />
          )}
        </section>

        <section>
          <h4>Theme</h4>
          <select aria-label="Theme" value={theme} onChange={(e) => onChange({ theme: e.target.value as ThemeId })}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </section>

        <section>
          <h4>Agent instructions</h4>
          <p className="settings-hint">
            Saved to <code>.github/copilot-instructions.md</code> in the current session's directory —
            the same file the real CLI's <code>/init</code> command and repo-level rules use.
          </p>
          <textarea
            className="mono settings-instructions"
            rows={6}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Always write tests for new code. Prefer functional React components."
          />
          <button
            disabled={instructionsStatus === 'saving'}
            onClick={async () => {
              setInstructionsStatus('saving');
              await window.copilotDesktop.files.writeInstructions(cwd, instructions);
              setInstructionsStatus('saved');
            }}
          >
            {instructionsStatus === 'saving' ? 'Saving…' : instructionsStatus === 'saved' ? 'Saved' : 'Save'}
          </button>
        </section>

        <section>
          <h4>MCP servers</h4>
          <ul className="settings-mcp-list">
            {mcpServers.map((s, i) => (
              <li key={i}>
                <span className="mono">{s.name}</span>
                <span className="mono settings-mcp-list__cmd">{s.command}</span>
                <button
                  onClick={() =>
                    onChange({ mcpServers: mcpServers.filter((_, idx) => idx !== i) })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="settings-mcp-add">
            <input placeholder="name" value={newServerName} onChange={(e) => setNewServerName(e.target.value)} />
            <input
              placeholder="command"
              value={newServerCommand}
              onChange={(e) => setNewServerCommand(e.target.value)}
            />
            <button
              onClick={() => {
                if (!newServerName.trim() || !newServerCommand.trim()) return;
                onChange({ mcpServers: [...mcpServers, { name: newServerName, command: newServerCommand }] });
                setNewServerName('');
                setNewServerCommand('');
              }}
            >
              Add
            </button>
          </div>
        </section>

        <div className="modal__actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

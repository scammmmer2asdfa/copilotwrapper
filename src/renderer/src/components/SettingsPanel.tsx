import React, { useState } from 'react';
import type { EditorId } from '../../../main/editor';

interface McpServerRow {
  name: string;
  command: string;
}

interface Props {
  editor: EditorId;
  customBinary: string;
  theme: 'graphite' | 'paper';
  mcpServers: McpServerRow[];
  onChange: (patch: Partial<{ editor: EditorId; customBinary: string; theme: 'graphite' | 'paper'; mcpServers: McpServerRow[] }>) => void;
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
  const { editor, customBinary, theme, mcpServers, onChange, onClose } = props;
  const [newServerName, setNewServerName] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal modal--settings">
        <h3>Settings</h3>

        <section>
          <h4>Editor</h4>
          <select value={editor} onChange={(e) => onChange({ editor: e.target.value as EditorId })}>
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
          <div className="settings-theme-toggle">
            <button className={theme === 'graphite' ? 'active' : ''} onClick={() => onChange({ theme: 'graphite' })}>
              Graphite
            </button>
            <button className={theme === 'paper' ? 'active' : ''} onClick={() => onChange({ theme: 'paper' })}>
              Paper
            </button>
          </div>
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

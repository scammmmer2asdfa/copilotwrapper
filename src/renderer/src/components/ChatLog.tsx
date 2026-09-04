import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../log-model';

interface Props {
  entries: LogEntry[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
  canSend: boolean;
  turnInFlight: boolean;
}

export function ChatLog({ entries, input, onInputChange, onSend, onCancel, canSend, turnInFlight }: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries]);

  return (
    <div className="chat-log">
      <div className="chat-log__scroll mono" ref={scrollRef}>
        {entries.map((e) => (
          <LogEntryView key={e.id} entry={e} />
        ))}
      </div>
      <form
        className="chat-log__input"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (canSend && input.trim()) onSend();
        }}
      >
        <textarea
          className="mono"
          rows={3}
          value={input}
          placeholder="Message Copilot…"
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend && input.trim()) onSend();
            }
          }}
        />
        <div className="chat-log__actions">
          {turnInFlight && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={!canSend || !input.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function LogEntryView({ entry }: { entry: LogEntry }): React.JSX.Element {
  switch (entry.kind) {
    case 'user':
      return <div className="log-entry log-entry--user">{entry.text}</div>;
    case 'agent':
      return <div className="log-entry log-entry--agent">{entry.text}</div>;
    case 'thought':
      return <div className="log-entry log-entry--thought">{entry.text}</div>;
    case 'plan':
      return (
        <div className="log-entry log-entry--plan">
          {entry.entries.map((p, i) => (
            <div key={i} className={`plan-item plan-item--${p.status}`}>
              <span className="plan-item__status">{p.status === 'completed' ? '✓' : p.status === 'in_progress' ? '…' : '○'}</span>
              {p.content}
            </div>
          ))}
        </div>
      );
    case 'tool':
      return (
        <div className={`log-entry log-entry--tool log-entry--tool-${entry.status}`}>
          🔧 {entry.title} <span className="tool-status">{entry.status}</span>
        </div>
      );
  }
}

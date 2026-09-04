import React from 'react';
import type { SessionSummary } from '../../../shared/ipc';
import { Icon } from './Icon';

interface Props {
  sessions: SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
  onToggleTerminal: () => void;
}

export function IconRail({ sessions, activeId, onSelect, onNew, onSettings, onToggleTerminal }: Props): React.JSX.Element {
  return (
    <div className="icon-rail">
      <button className="icon-rail__new" onClick={onNew} title="New session">
        <Icon name="plus" />
      </button>
      <div className="icon-rail__list">
        {sessions.map((s) => (
          <button
            key={s.id}
            className={'icon-rail__item' + (s.id === activeId ? ' icon-rail__item--active' : '')}
            title={s.title}
            onClick={() => onSelect(s.id)}
          >
            {s.title.slice(0, 2).toUpperCase() || '??'}
          </button>
        ))}
      </div>
      <button className="icon-rail__terminal" onClick={onToggleTerminal} title="Terminal">
        <Icon name="terminal" />
      </button>
      <button className="icon-rail__settings" onClick={onSettings} title="Settings">
        <Icon name="settings" />
      </button>
    </div>
  );
}

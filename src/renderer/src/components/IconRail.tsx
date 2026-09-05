import React from 'react';
import type { Tab } from '../../../shared/ipc';
import { Icon } from './Icon';

interface Props {
  tabs: Tab[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
  onToggleTerminal: () => void;
  onToggleTheme: () => void;
}

export function IconRail({ tabs, activeId, onSelect, onClose, onNew, onToggleTerminal, onToggleTheme }: Props): React.JSX.Element {
  return (
    <div className="icon-rail">
      <button className="icon-rail__new" onClick={onNew} title="New tab (github.com)">
        <Icon name="plus" />
      </button>
      <div className="icon-rail__list">
        {tabs.map((t) => (
          <div key={t.id} className="icon-rail__tab-wrap">
            <button
              className={'icon-rail__item' + (t.id === activeId ? ' icon-rail__item--active' : '')}
              title={`${t.title} — ${t.url}`}
              onClick={() => onSelect(t.id)}
            >
              {t.title.slice(0, 2).toUpperCase() || '??'}
            </button>
            <button
              className="icon-rail__tab-close"
              title="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
            >
              <Icon name="close" size={10} />
            </button>
          </div>
        ))}
      </div>
      <button className="icon-rail__terminal" onClick={onToggleTerminal} title="Terminal">
        <Icon name="terminal" />
      </button>
      <button className="icon-rail__settings" onClick={onToggleTheme} title="Theme">
        <Icon name="settings" />
      </button>
    </div>
  );
}

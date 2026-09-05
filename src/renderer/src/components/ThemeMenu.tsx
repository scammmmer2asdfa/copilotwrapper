import React from 'react';
import { THEMES, type ThemeId } from '../themes';
import { useEscapeKey } from '../useEscapeKey';

interface Props {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
  onClose: () => void;
}

/** Small popover — the only remaining "setting" is theme, so a whole panel would be overkill. */
export function ThemeMenu({ theme, onChange, onClose }: Props): React.JSX.Element {
  useEscapeKey(onClose);

  return (
    <div className="theme-menu-overlay" onClick={onClose}>
      <div className="theme-menu" onClick={(e) => e.stopPropagation()}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={t.id === theme ? 'active' : ''}
            onClick={() => {
              onChange(t.id);
              onClose();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

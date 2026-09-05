import React from 'react';
import { TerminalPanel } from './TerminalPanel';
import { Icon } from './Icon';
import { useEscapeKey } from '../useEscapeKey';

interface Props {
  onClose: () => void;
}

/** Bottom terminal panel — a real shell (node-pty), independent of any codespace tab. */
export function BottomPanel({ onClose }: Props): React.JSX.Element {
  // Escape must reach the real shell (vim, etc.) rather than closing the
  // panel, so this only listens when the terminal surface itself isn't
  // where focus is - handled by TerminalPanel capturing its own keydowns;
  // here we simply don't bind Escape globally at all for this panel.
  useEscapeKey(onClose, false);

  return (
    <div className="bottom-panel">
      <div className="bottom-panel__tabs">
        <span className="bottom-panel__title">Terminal</span>
        <button className="bottom-panel__close" onClick={onClose} title="Close panel">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="bottom-panel__body">
        <TerminalPanel id="main" />
      </div>
    </div>
  );
}

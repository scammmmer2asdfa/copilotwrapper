import React from 'react';

interface Props {
  webUrl: string;
  visible: boolean;
}

/** One codespace's own web editor (github.dev), embedded directly — no OS browser chrome intercepting keybinds before they reach it. */
export function CodespaceView({ webUrl, visible }: Props): React.JSX.Element {
  return (
    <div className="codespace-view" style={{ display: visible ? 'block' : 'none' }}>
      <webview src={webUrl} className="codespace-view__webview" allowpopups />
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface Props {
  onClose: () => void;
}

type WebviewElement = HTMLElement & { goBack(): void; goForward(): void; reload(): void };

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(:\d+)?/i.test(trimmed) || /^\d{1,3}(\.\d{1,3}){3}/.test(trimmed)) return `http://${trimmed}`;
  return `https://${trimmed}`;
}

/** Right Shift toggles this: a quick, transient in-app browser for any URL — not tied to any codespace tab. */
export function QuickBrowsePanel({ onClose }: Props): React.JSX.Element {
  const [input, setInput] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const webviewRef = useRef<WebviewElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      // Only close on Escape when the webview itself doesn't have focus -
      // otherwise Escape should reach the site being browsed.
      if (e.key === 'Escape' && document.activeElement !== webviewRef.current) onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal modal--browse">
        <form
          className="quick-browse__bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) setUrl(normalizeUrl(input));
          }}
        >
          <button type="button" onClick={() => webviewRef.current?.goBack()} title="Back">
            <Icon name="arrow-left" size={14} />
          </button>
          <button type="button" onClick={() => webviewRef.current?.goForward()} title="Forward">
            <Icon name="arrow-right" size={14} />
          </button>
          <button type="button" onClick={() => webviewRef.current?.reload()} title="Reload">
            <Icon name="refresh" size={14} />
          </button>
          <input
            ref={inputRef}
            className="mono"
            placeholder="Type a URL and press Enter…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit">Go</button>
          <button type="button" onClick={onClose} title="Close">
            <Icon name="close" size={14} />
          </button>
        </form>
        <div className="quick-browse__body">
          {url ? (
            <webview ref={webviewRef} src={url} className="quick-browse__webview" allowpopups />
          ) : (
            <div className="quick-browse__empty">Enter a URL above to browse it in-app.</div>
          )}
        </div>
      </div>
    </div>
  );
}

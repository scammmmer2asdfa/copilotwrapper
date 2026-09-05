import React, { useEffect, useRef } from 'react';

interface Props {
  url: string;
  visible: boolean;
  onNavigate: (url: string, title: string) => void;
}

type WebviewElement = HTMLElement & { getURL(): string; getTitle(): string };

/** One tab's embedded page — signing into github.com and opening a codespace all happens right here, no OS browser, no CLI required. */
export function TabView({ url, visible, onNavigate }: Props): React.JSX.Element {
  const webviewRef = useRef<WebviewElement>(null);

  useEffect(() => {
    const el = webviewRef.current;
    if (!el) return;
    const handleNavigate = () => onNavigate(el.getURL(), el.getTitle());
    el.addEventListener('did-navigate', handleNavigate);
    el.addEventListener('did-navigate-in-page', handleNavigate);
    el.addEventListener('page-title-updated', handleNavigate);
    return () => {
      el.removeEventListener('did-navigate', handleNavigate);
      el.removeEventListener('did-navigate-in-page', handleNavigate);
      el.removeEventListener('page-title-updated', handleNavigate);
    };
  }, [onNavigate]);

  return (
    <div className="tab-view" style={{ display: visible ? 'block' : 'none' }}>
      <webview ref={webviewRef} src={url} className="tab-view__webview" allowpopups />
    </div>
  );
}

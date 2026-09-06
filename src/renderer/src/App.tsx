import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TAB_URL, type Tab } from '../../shared/ipc';
import { IconRail } from './components/IconRail';
import { TabView } from './components/TabView';
import { QuickBrowsePanel } from './components/QuickBrowsePanel';
import { BottomPanel } from './components/BottomPanel';
import { ThemeMenu } from './components/ThemeMenu';
import type { ThemeId } from './themes';
import './app.css';

export function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [quickBrowseOpen, setQuickBrowseOpen] = useState(false);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('graphite');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    void (async () => {
      const settings = await window.copilotDesktop.settings.getAll();
      if (settings['theme']) setTheme(settings['theme'] as ThemeId);

      const existing = await window.copilotDesktop.tabs.list();
      setTabs(existing);
      if (existing.length > 0) setActiveId(existing[0].id);
    })();
  }, []);

  // Right Shift alone (not part of a combo like Shift+Tab) toggles the
  // quick browser - tracked via keydown/keyup rather than a single keydown
  // check, so holding Shift while pressing another key doesn't trigger it.
  const rightShiftOnlyRef = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftRight') rightShiftOnlyRef.current = true;
      else rightShiftOnlyRef.current = false;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftRight' && rightShiftOnlyRef.current) {
        setQuickBrowseOpen((v) => !v);
      }
      rightShiftOnlyRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const persistTheme = useCallback((next: ThemeId) => {
    setTheme(next);
    void window.copilotDesktop.settings.set('theme', next);
  }, []);

  const handleNewTab = useCallback(async () => {
    const tab = await window.copilotDesktop.tabs.add({ url: DEFAULT_TAB_URL, title: 'GitHub' });
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }, []);

  const handleCloseTab = useCallback(
    async (id: number) => {
      await window.copilotDesktop.tabs.remove(id);
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeId === id) setActiveId(next.length > 0 ? next[0].id : null);
        return next;
      });
    },
    [activeId]
  );

  // Persisted so relaunching the app resumes each tab where it was left,
  // e.g. inside a codespace's own editor rather than back at github.com.
  const handleNavigate = useCallback((id: number, url: string, title: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, url, title } : t)));
    void window.copilotDesktop.tabs.update(id, { url, title });
  }, []);

  return (
    <div className="app">
      <div className="app__main">
        <IconRail
          tabs={tabs}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={(id) => void handleCloseTab(id)}
          onNew={() => void handleNewTab()}
          onToggleTerminal={() => setBottomPanelOpen((v) => !v)}
          onToggleTheme={() => setThemeMenuOpen((v) => !v)}
        />

        <div className="app__content">
          {tabs.length === 0 && (
            <div className="app__empty">
              <p>No tabs open.</p>
              <button className="button--primary" onClick={() => void handleNewTab()}>
                Sign in to github.com
              </button>
              <button onClick={() => void window.copilotDesktop.shell.openExternal(DEFAULT_TAB_URL)}>
                Open in browser instead
              </button>
              <p className="settings-hint">Or press Right Shift to browse any URL in-app.</p>
            </div>
          )}
          {tabs.map((t) => (
            <TabView
              key={t.id}
              url={t.url}
              visible={t.id === activeId}
              onNavigate={(url, title) => handleNavigate(t.id, url, title)}
            />
          ))}
        </div>
      </div>

      {bottomPanelOpen && <BottomPanel onClose={() => setBottomPanelOpen(false)} />}

      {quickBrowseOpen && <QuickBrowsePanel onClose={() => setQuickBrowseOpen(false)} />}

      {themeMenuOpen && <ThemeMenu theme={theme} onChange={persistTheme} onClose={() => setThemeMenuOpen(false)} />}
    </div>
  );
}

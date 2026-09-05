import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CodespaceSummary, CodespaceTab } from '../../shared/ipc';
import { IconRail } from './components/IconRail';
import { CodespaceView } from './components/CodespaceView';
import { CodespacePicker } from './components/CodespacePicker';
import { QuickBrowsePanel } from './components/QuickBrowsePanel';
import { BottomPanel } from './components/BottomPanel';
import { ThemeMenu } from './components/ThemeMenu';
import type { ThemeId } from './themes';
import './app.css';

export function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<CodespaceTab[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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

      const existing = await window.copilotDesktop.codespaceTabs.list();
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

  const handleAddCodespace = useCallback(async (codespace: CodespaceSummary) => {
    const tab = await window.copilotDesktop.codespaceTabs.add({
      codespaceName: codespace.name,
      displayName: codespace.displayName,
      repository: codespace.repository,
      webUrl: codespace.webUrl
    });
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setPickerOpen(false);
  }, []);

  const handleCloseTab = useCallback(
    async (id: number) => {
      await window.copilotDesktop.codespaceTabs.remove(id);
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeId === id) setActiveId(next.length > 0 ? next[0].id : null);
        return next;
      });
    },
    [activeId]
  );

  return (
    <div className="app">
      <div className="app__main">
        <IconRail
          tabs={tabs}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={(id) => void handleCloseTab(id)}
          onNew={() => setPickerOpen(true)}
          onToggleTerminal={() => setBottomPanelOpen((v) => !v)}
          onToggleTheme={() => setThemeMenuOpen((v) => !v)}
        />

        <div className="app__content">
          {tabs.length === 0 && (
            <div className="app__empty">
              <p>No codespaces open.</p>
              <button className="button--primary" onClick={() => setPickerOpen(true)}>
                Open a codespace
              </button>
              <p className="settings-hint">Or press Right Shift to browse any URL in-app.</p>
            </div>
          )}
          {tabs.map((t) => (
            <CodespaceView key={t.id} webUrl={t.webUrl} visible={t.id === activeId} />
          ))}
        </div>
      </div>

      {bottomPanelOpen && <BottomPanel onClose={() => setBottomPanelOpen(false)} />}

      {pickerOpen && <CodespacePicker onAdd={(c) => void handleAddCodespace(c)} onClose={() => setPickerOpen(false)} />}

      {quickBrowseOpen && <QuickBrowsePanel onClose={() => setQuickBrowseOpen(false)} />}

      {themeMenuOpen && <ThemeMenu theme={theme} onChange={persistTheme} onClose={() => setThemeMenuOpen(false)} />}
    </div>
  );
}

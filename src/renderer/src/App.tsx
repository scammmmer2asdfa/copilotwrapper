import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionSummary } from '../../shared/ipc';
import type { EditorId } from '../../main/editor';
import { IconRail } from './components/IconRail';
import { ChatLog } from './components/ChatLog';
import { StatusRail } from './components/StatusRail';
import { PermissionDialog, type PermissionOptionView } from './components/PermissionDialog';
import { AuthPanel } from './components/AuthPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupWizard } from './components/SetupWizard';
import { BottomPanel } from './components/BottomPanel';
import { applySessionUpdate, type LogEntry } from './log-model';
import type { ThemeId } from './themes';
import './app.css';

interface PendingPermission {
  requestId: string;
  toolTitle: string;
  options: PermissionOptionView[];
}

interface McpServerRow {
  name: string;
  command: string;
}

export function App(): React.JSX.Element {
  const [connectState, setConnectState] = useState('disconnected');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [logsBySession, setLogsBySession] = useState<Record<string, LogEntry[]>>({});
  const [queueDepth, setQueueDepth] = useState(0);
  const [input, setInput] = useState('');
  const [turnInFlight, setTurnInFlight] = useState(false);
  const [modes, setModes] = useState<{ id: string; name: string }[]>([]);
  const [currentModeId, setCurrentModeId] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authRunning, setAuthRunning] = useState(false);
  const [authDone, setAuthDone] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState<EditorId>('vscode');
  const [customBinary, setCustomBinary] = useState('');
  const [theme, setTheme] = useState<ThemeId>('graphite');
  const [mcpServers, setMcpServers] = useState<McpServerRow[]>([]);
  const [cliPath, setCliPath] = useState('');
  const [setupDone, setSetupDone] = useState<boolean | null>(null);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);

  const activeLog = useMemo(() => (activeId ? logsBySession[activeId] ?? [] : []), [activeId, logsBySession]);
  const activeCwd = useMemo(() => sessions.find((s) => s.id === activeId)?.cwd ?? '.', [sessions, activeId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const api = window.copilotDesktop;

    const offConnect = api.agent.onConnectState((state: string) => {
      setConnectState(state);
      if (state === 'error') setNeedsAuth(true);
    });

    const offUpdate = api.chat.onSessionUpdate((raw: unknown) => {
      const params = raw as { sessionId: string; update: { sessionUpdate: string; [k: string]: unknown } };
      setLogsBySession((prev) => ({
        ...prev,
        [params.sessionId]: applySessionUpdate(prev[params.sessionId] ?? [], params.update)
      }));
    });

    const offQueue = api.chat.onQueueDepth((sessionId: string, depth: number) => {
      if (sessionId === activeId) setQueueDepth(depth);
    });

    const offPermission = api.chat.onRequestPermission((raw: unknown) => {
      const payload = raw as {
        requestId: string;
        toolCall: { title?: string; toolCallId: string };
        options: PermissionOptionView[];
      };
      setPendingPermission({
        requestId: payload.requestId,
        toolTitle: payload.toolCall.title ?? payload.toolCall.toolCallId,
        options: payload.options
      });
    });

    const offAuthCode = api.auth.onCode((info: { code: string; url?: string }) => {
      setAuthCode(info.code);
      setAuthUrl(info.url ?? null);
    });

    const offAuthDone = api.auth.onDone((success: boolean) => {
      setAuthDone(success);
      setAuthRunning(false);
      if (success) setNeedsAuth(false);
    });

    void (async () => {
      const settings = await api.settings.getAll();
      if (settings['editor']) setEditor(settings['editor'] as EditorId);
      if (settings['customBinary']) setCustomBinary(settings['customBinary']);
      if (settings['theme']) setTheme(settings['theme'] as ThemeId);
      if (settings['mcpServers']) setMcpServers(JSON.parse(settings['mcpServers']));
      if (settings['cliPath']) setCliPath(settings['cliPath']);
      setSetupDone(settings['setupCompleted'] === 'true');

      try {
        const initResult = (await api.agent.start(await getCwd())) as {
          authMethods?: unknown[];
        };
        if (!initResult) setNeedsAuth(true);
      } catch {
        setNeedsAuth(true);
      }

      const existing = await api.sessions.list();
      setSessions(existing);
    })();

    return () => {
      offConnect();
      offUpdate();
      offQueue();
      offPermission();
      offAuthCode();
      offAuthDone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCwd = useCallback(async () => {
    return '.';
  }, []);

  const handleNewSession = useCallback(async () => {
    const cwd = await getCwd();
    const result = (await window.copilotDesktop.sessions.create(cwd)) as {
      sessionId: string;
      modes?: { availableModes: { id: string; name: string }[]; currentModeId: string };
    };
    const list = await window.copilotDesktop.sessions.list();
    setSessions(list);
    setActiveId(result.sessionId);
    if (result.modes) {
      setModes(result.modes.availableModes);
      setCurrentModeId(result.modes.currentModeId);
    }
  }, [getCwd]);

  const handleSend = useCallback(async () => {
    if (!activeId || !input.trim()) return;
    const text = input;
    setInput('');
    setLogsBySession((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), { kind: 'user', id: crypto.randomUUID(), text }]
    }));
    setTurnInFlight(true);
    try {
      await window.copilotDesktop.chat.send(activeId, text);
    } finally {
      setTurnInFlight(false);
    }
  }, [activeId, input]);

  const handleCancel = useCallback(() => {
    if (activeId) window.copilotDesktop.chat.cancel(activeId);
  }, [activeId]);

  const handleModeChange = useCallback(
    (modeId: string) => {
      if (!activeId) return;
      setCurrentModeId(modeId);
      window.copilotDesktop.chat.setMode(activeId, modeId);
    },
    [activeId]
  );

  const handlePermissionChoice = useCallback(
    (optionId: string | null) => {
      if (!pendingPermission) return;
      window.copilotDesktop.chat.respondPermission({ requestId: pendingPermission.requestId, optionId });
      setPendingPermission(null);
    },
    [pendingPermission]
  );

  const persistSettings = useCallback((patch: Record<string, string>) => {
    for (const [k, v] of Object.entries(patch)) void window.copilotDesktop.settings.set(k, v);
  }, []);

  return (
    <div className="app">
      <div className="app__main">
        <IconRail
          sessions={sessions}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={handleNewSession}
          onSettings={() => setSettingsOpen(true)}
          onToggleTerminal={() => setBottomPanelOpen((v) => !v)}
        />

        <ChatLog
          entries={activeLog}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onCancel={handleCancel}
          canSend={connectState === 'connected' && !!activeId}
          turnInFlight={turnInFlight}
        />

        <StatusRail
          connectState={connectState}
          queueDepth={queueDepth}
          modes={modes}
          currentModeId={currentModeId}
          onModeChange={handleModeChange}
        />
      </div>

      {bottomPanelOpen && <BottomPanel cwd={activeCwd} onClose={() => setBottomPanelOpen(false)} />}

      {setupDone === false && (
        <SetupWizard
          onContinue={() => {
            setSetupDone(true);
            persistSettings({ setupCompleted: 'true' });
          }}
        />
      )}

      {needsAuth && (
        <div className="overlay-panel">
          <AuthPanel
            code={authCode}
            url={authUrl}
            running={authRunning}
            done={authDone}
            onStart={() => {
              setAuthRunning(true);
              setAuthDone(null);
              void window.copilotDesktop.auth.start();
            }}
            onCancel={() => {
              void window.copilotDesktop.auth.cancel();
              setAuthRunning(false);
            }}
          />
        </div>
      )}

      {pendingPermission && (
        <PermissionDialog
          toolTitle={pendingPermission.toolTitle}
          options={pendingPermission.options}
          onChoose={handlePermissionChoice}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          editor={editor}
          customBinary={customBinary}
          theme={theme}
          mcpServers={mcpServers}
          cliPath={cliPath}
          cwd={activeCwd}
          onChange={(patch) => {
            if (patch.editor !== undefined) {
              setEditor(patch.editor);
              persistSettings({ editor: patch.editor });
            }
            if (patch.customBinary !== undefined) {
              setCustomBinary(patch.customBinary);
              persistSettings({ customBinary: patch.customBinary });
            }
            if (patch.theme !== undefined) {
              setTheme(patch.theme);
              persistSettings({ theme: patch.theme });
            }
            if (patch.mcpServers !== undefined) {
              setMcpServers(patch.mcpServers);
              persistSettings({ mcpServers: JSON.stringify(patch.mcpServers) });
            }
            if (patch.cliPath !== undefined) {
              setCliPath(patch.cliPath);
              persistSettings({ cliPath: patch.cliPath });
              // Reconnect using the newly configured (or newly cleared) CLI path.
              setNeedsAuth(false);
              void window.copilotDesktop.agent.start('.');
            }
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

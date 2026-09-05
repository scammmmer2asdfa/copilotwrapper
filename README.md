# Copilot Desktop

A native Electron shell for **GitHub Codespaces**. Each tab is a real, isolated browser view that
starts at `github.com/codespaces` — sign in exactly like you would in any browser, then open a
codespace and its own web editor (`github.dev`) loads right there in the same tab, inside a dedicated
app window instead of a browser tab — so your OS browser's own keyboard shortcuts (Ctrl+W, Ctrl+T,
Cmd+`,`, etc.) don't intercept keystrokes meant for the editor running inside it.

This is an independent project, not affiliated with or endorsed by GitHub.

## Why a dedicated app instead of just a browser tab

The Codespaces web editor is a full copy of VS Code running in your browser. Browsers reserve a lot
of keyboard shortcuts for themselves before a page ever sees them, which is a real, common annoyance
for any browser-hosted editor. A dedicated Electron window has no such browser chrome capturing input
first — keystrokes go straight to the embedded view.

## Features

- **Browser tabs, not a CLI-backed picker** — the `+` button opens a new tab pointed at
  `github.com/codespaces`. Sign in there like you would on any website (no separate app sign-in flow,
  no device codes) and click a codespace to open it; the tab navigates straight to that codespace's
  own `github.dev` editor. Tabs (their current URL and title) persist across restarts in a local
  SQLite database, so relaunching resumes each tab exactly where it was left.
- **A real embedded terminal** — a PTY-backed terminal panel (`node-pty` + `xterm.js`, the same stack
  VS Code's own integrated terminal uses) for running local commands alongside your codespace tabs,
  independent of any of them.
- **Right Shift → quick browser** — press Right Shift anywhere to pop up a small in-app browser (URL
  bar, back/forward/reload) for visiting any site without leaving the app or opening a real browser
  tab. Press Right Shift again to close it.
- **Five themes** — Graphite, Paper, and three real GitHub/Primer palettes (GitHub Dark, GitHub Dark
  Dimmed, GitHub Light).
- **No CLI, no token handling** — there's nothing to install or authenticate outside the app. Signing
  into `github.com` inside a tab uses Electron's normal persistent session/cookie storage, exactly
  like signing into any site in a regular browser; this app never sees, stores, or transmits a GitHub
  token itself.

## Architecture

```
Electron main process
  ├─ db.ts (tabs + settings)  → persists each tab's url/title so restarts resume in place
  └─ node-pty                → a real local shell for the terminal panel

Electron renderer (React)
  ├─ IconRail        — open tabs, terminal toggle, theme menu
  ├─ TabView          — <webview src={tab.url}> per open tab; tracks navigation to persist it
  ├─ QuickBrowsePanel — Right Shift; ad-hoc in-app browsing, not persisted
  └─ BottomPanel     — the real terminal (node-pty)
```

- **`src/main/db.ts`** persists just two things: UI settings (currently only theme) and the open
  tabs (`url`, `title`, order), so they're restored across restarts.
- **`src/renderer/src/components/TabView.tsx`** listens for the `<webview>`'s own `did-navigate` /
  `page-title-updated` events and reports them back up so the tab's persisted `url`/`title` stay in
  sync as the user signs in, browses the codespaces list, and opens an editor — all of that happens
  as ordinary in-page navigation inside the same webview, no custom scraping or GitHub API calls
  involved.
- **`src/main/terminal-manager.ts`** owns real PTY sessions per terminal tab.
- **`src/preload`** is the only bridge between the renderer and Node/Electron — the renderer has
  `nodeIntegration: false` and gets exactly the typed methods on `window.copilotDesktop` defined in
  `src/shared/ipc.ts`, nothing else. The `<webview>` tag used to embed tabs/browsed sites is a
  separate, isolated `webContents` with no access to that bridge.

## Repository layout

```
src/main/       Electron main process: db.ts (tab persistence), terminal-manager, IPC wiring
src/preload/    contextBridge API — the only surface the renderer can call into Node/Electron through
src/renderer/   React UI (Vite-built)
src/shared/     IPC channel names + payload types shared by main/preload/renderer
site/           Static multi-page marketing site
test/           Vitest suites (db/tab persistence behavior) + Playwright E2E
.github/        CI (lint/typecheck/test/e2e/build) and gated multi-platform release workflows
```

## Development

No external CLI or credentials setup required — just sign into `github.com` inside the app the first
time you open a tab.

```sh
npm install
npm run typecheck
npm test
npm run dev
```

### E2E tests

`test/e2e/` launches the actual built app via Playwright's Electron support and drives it through the
real UI — the empty state, opening a new tab pointed at `github.com`, the terminal panel, the theme
menu, and the Right Shift quick-browse toggle. These tests don't assume the runner is signed into a
real GitHub account; they only assert the tab/webview mechanics.

```sh
npm run build
npm run test:e2e
```

### Native modules

Two dependencies (`better-sqlite3`, `node-pty`) ship native `.node` addons that must match whichever
Node ABI is actually loading them. `postinstall` rebuilds both for **Electron's** ABI (needed for
`npm run dev` and for packaging). That means plain `node` can't load them afterwards — so `npm test`
runs Vitest through Electron's own Node runtime instead
(`ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs run`), which always matches whatever
ABI `postinstall` just rebuilt for, with no manual rebuilding back and forth.

## Packaging

```sh
npm run build
npx electron-builder --mac|--win|--linux
```

`electron-builder.yml`'s `asarUnpack: ['**/*.node']` is required — without it, native addons end up
packed inside `app.asar`, which Electron cannot `dlopen`.

See [`.github/workflows/release.yml`](.github/workflows/release.yml) for the automated multi-platform
release pipeline (tag-push or manual-dispatch only — never on a plain push to `main`, so the scarce
macOS runners aren't queued for every commit). All three platform jobs upload build artifacts, and a
single final job creates the GitHub Release with everything attached, avoiding the race condition of
each platform job publishing independently.

## Troubleshooting

- **macOS says the app "contains malware" / won't open** — the build isn't code-signed or notarized
  (that requires a paid Apple Developer Program membership this project doesn't have), so Gatekeeper
  blocks it the same way it would any unsigned download. Open **System Settings → Privacy & Security**
  → scroll down → **"Open Anyway"**, or run `xattr -cr /path/to/Copilot Desktop.app` in Terminal. This
  is expected for unsigned open-source Mac apps generally, not specific to this one.
- **A tab keeps showing the GitHub sign-in page** — sign in normally in that tab; the session is
  stored the same way a regular browser stores cookies, so you shouldn't need to sign in again on
  future launches unless you sign out or clear the app's data.

## License

Copilot Desktop's own source code is MIT licensed — see [`LICENSE`](LICENSE).

## Site

`site/` is a static multi-page marketing site (`index.html`, `features.html`, `preview.html`,
`faq.html`, `download.html`, `docs.html`), sharing the app's design tokens (`styles.css`) and theme
toggle (`theme.js`).

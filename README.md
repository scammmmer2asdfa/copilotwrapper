# Copilot Desktop

A native Electron shell for **GitHub Codespaces**. It lists the codespaces on your GitHub account
(via the real `gh` CLI) and opens each one's own web editor (`github.dev`) directly inside a dedicated
app window instead of a browser tab — so your OS browser's own keyboard shortcuts (Ctrl+W, Ctrl+T,
Cmd+`,`, etc.) don't intercept keystrokes meant for the editor running inside it.

This is an independent project, not affiliated with or endorsed by GitHub.

## Why a dedicated app instead of just a browser tab

The Codespaces web editor is a full copy of VS Code running in your browser. Browsers reserve a lot
of keyboard shortcuts for themselves before a page ever sees them, which is a real, common annoyance
for any browser-hosted editor. A dedicated Electron window has no such browser chrome capturing input
first — keystrokes go straight to the embedded view.

## Features

- **Codespace tabs** — the icon rail lists your open codespaces as tabs (persisted across restarts in
  a local SQLite database); the `+` button opens a picker backed by the real
  `gh api user/codespaces` call, and each tab embeds that codespace's real `web_url` directly in an
  Electron `<webview>`.
- **A real embedded terminal** — a PTY-backed terminal panel (`node-pty` + `xterm.js`, the same stack
  VS Code's own integrated terminal uses) for running local commands alongside your codespace tabs,
  independent of any of them.
- **Right Shift → quick browser** — press Right Shift anywhere to pop up a small in-app browser (URL
  bar, back/forward/reload) for visiting any site without leaving the app or opening a real browser
  tab. Press Right Shift again to close it.
- **Five themes** — Graphite, Paper, and three real GitHub/Primer palettes (GitHub Dark, GitHub Dark
  Dimmed, GitHub Light).
- **No token handling** — codespace listing and opening both shell out to the `gh` CLI you already
  have installed and signed in; this app never sees, stores, or transmits a GitHub token itself.

## Architecture

```
Electron main process
  ├─ gh api user/codespaces        → list your codespaces (name, repo, state, real web_url)
  ├─ gh codespace code -c <name> --web   → fallback: open a codespace in your OS browser
  └─ node-pty                       → a real local shell for the terminal panel

Electron renderer (React)
  ├─ IconRail        — open codespace tabs, terminal toggle, theme menu
  ├─ CodespaceView   — <webview src="https://<name>.github.dev"> per open tab
  ├─ CodespacePicker — lists real codespaces from gh, lets you open one as a tab
  ├─ QuickBrowsePanel — Right Shift; ad-hoc in-app browsing, not persisted
  └─ BottomPanel     — the real terminal (node-pty)
```

- **`src/main/codespaces.ts`** shells out to `gh api user/codespaces` (not `gh codespace list
  --json`, which doesn't include the `web_url` field this app actually needs — verified against the
  real API response before writing this) and to `gh codespace code -c <name> --web` for the
  browser-fallback action.
- **`src/main/terminal-manager.ts`** owns real PTY sessions per terminal tab.
- **`src/main/db.ts`** persists just two things: UI settings (currently only theme) and the list of
  open codespace tabs, so they're restored across restarts.
- **`src/preload`** is the only bridge between the renderer and Node/Electron — the renderer has
  `nodeIntegration: false` and gets exactly the typed methods on `window.copilotDesktop` defined in
  `src/shared/ipc.ts`, nothing else. The `<webview>` tag used to embed codespaces/browsed sites is a
  separate, isolated `webContents` with no access to that bridge.

## Repository layout

```
src/main/       Electron main process: codespaces.ts (gh CLI wrapper), terminal-manager, db, IPC wiring
src/preload/    contextBridge API — the only surface the renderer can call into Node/Electron through
src/renderer/   React UI (Vite-built)
src/shared/     IPC channel names + payload types shared by main/preload/renderer
site/           Static multi-page marketing site
test/           Vitest suites (db behavior + integration test against the real gh CLI) + Playwright E2E
.github/        CI (lint/typecheck/test/e2e/build) and gated multi-platform release workflows
```

## Development

Requires the [`gh` CLI](https://cli.github.com/) installed and signed in (`gh auth login`) to actually
list/open codespaces — the app itself never handles GitHub credentials.

```sh
npm install
npm run typecheck
npm test
npm run dev
```

### E2E tests

`test/e2e/` launches the actual built app via Playwright's Electron support and drives it through the
real UI — the empty state, the codespace picker (against whatever `gh` account is signed in on the
machine running the suite), the terminal panel, the theme menu, and the Right Shift quick-browse
toggle.

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
- **The codespace picker shows an error instead of a list** — make sure `gh auth status` succeeds in
  a normal terminal on the same machine. The app shells out to your existing `gh` session; it doesn't
  do its own GitHub authentication.

## License

Copilot Desktop's own source code is MIT licensed — see [`LICENSE`](LICENSE).

## Site

`site/` is a static multi-page marketing site (`index.html`, `features.html`, `preview.html`,
`faq.html`, `download.html`, `docs.html`), sharing the app's design tokens (`styles.css`) and theme
toggle (`theme.js`).

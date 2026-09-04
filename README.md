# Copilot Desktop

An Electron shell around the official [GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot). The main
process spawns `copilot --acp` (the CLI's Agent Client Protocol server) and speaks newline-delimited
JSON-RPC over its stdio directly — no scraped terminal output, no reimplemented chat engine, no
guessed flags. This is an independent, unaffiliated client: it is not built or endorsed by GitHub.

## Why this exists

The official Copilot CLI is a terminal application. That's great for scripting and for people who
live in a terminal, but it means no persistent session history across restarts, no visual diffing of
what a tool call actually touched, no way to run a completely unrelated shell command alongside a
running agent turn without losing your place, and no GUI affordances for the things a chat agent
naturally wants (a device-code sign-in screen, a permission dialog, a place to configure which editor
"open this file" should use). Copilot Desktop is a thin, honest client on top of the same CLI and the
same protocol it already exposes for exactly this purpose (ACP) — it adds a UI, a durable local
database, and process management around the CLI, and nothing else. It does not reimplement any of the
agent's actual behavior.

## Architecture

```
Electron main process
  └─ spawns: copilot --acp   (child_process, stdio pipes)
       └─ speaks: newline-delimited JSON-RPC (Agent Client Protocol)
            initialize, session/new, session/prompt, session/cancel, session/set_mode
            ← session/update notifications (message/thought chunks, plans, tool calls)
            ← session/request_permission (blocks the turn until the UI responds)

Electron renderer (React)
  ← IPC ← main process ← ACP client ← copilot --acp subprocess
```

- **`src/main/acp-client.ts`** is the JSON-RPC layer: it frames/parses newline-delimited JSON over the
  subprocess's stdio, tracks pending request IDs, and turns inbound notifications and requests into
  Node `EventEmitter` events the rest of the app can subscribe to.
- **`src/main/agent-manager.ts`** owns the subprocess's lifecycle and a per-session send queue backed
  by SQLite (`src/main/db.ts`). If you send a message while a turn is already in flight, it's written
  to the `queue` table with status `queued` rather than interrupting the current `session/prompt`
  call. Once the turn resolves, the manager drains the queue for that session one item at a time, in
  order. A message is marked `sending` right before dispatch; if the process crashes mid-send,
  `openDatabase()` resets any `sending` row back to `queued` on the next launch — so a crash never
  silently drops a message, it just gets retried.
- **`src/main/auth.ts`** never touches a token. `initialize()`'s response includes
  `authMethods[]._meta['terminal-auth']`, which is the exact command/args the *real* CLI wants run
  (`copilot login`) to start its own device-code flow. This module just spawns that command and
  regex-scrapes the device code and verification URL out of its stdout/stderr for display — the
  actual OAuth/token exchange happens entirely inside the CLI process.
- **`src/main/cli-locator.ts`** resolves which `copilot` binary to run, in order: an explicit
  user-configured override, the packaged app's bundled binary, the vendored dev-mode binary (see
  below), a locally installed `@github/copilot-<platform>` npm package, then `PATH`.
- **`src/main/terminal-manager.ts`** owns real PTY sessions via [`node-pty`](https://www.npmjs.com/package/node-pty)
  (the same library VS Code's own integrated terminal uses) — a genuine shell, not a simulated log.
- **`src/preload`** is the only bridge between the renderer and Node/Electron APIs, via
  `contextBridge.exposeInMainWorld`. The renderer never gets `nodeIntegration`; every capability it
  has is an explicit, typed method on `window.copilotDesktop` (see `src/shared/ipc.ts` for the full
  contract).

## Features

- **Real ACP client** — `initialize`, `session/new`, `session/prompt`, `session/cancel`,
  `session/set_mode`, live `session/update` streaming (message/thought chunks, plans, tool calls), and
  inbound `session/request_permission` that actually blocks the turn until you respond (allow once,
  allow always, or reject) in a modal dialog, right where the tool call happened.
- **A send queue that survives crashes** — messages sent mid-turn are queued per-session in SQLite and
  dispatched in order once the current turn finishes; a message marked "sending" when the app reopens
  gets reset to "queued" rather than lost.
- **Device-code sign-in** — runs the CLI's own `copilot login` and shows you the code; no token is
  ever handled by this app directly.
- **A real embedded terminal** — a PTY-backed terminal panel (node-pty + xterm.js, the same stack VS
  Code uses) for running your own commands alongside a session, plus a live "Agent Output" tab
  streaming the CLI subprocess's own stderr so you can see what it's actually doing.
- **First-run setup wizard** — detects the bundled CLI, any system-installed `copilot` on `PATH`, and
  your system Node.js/npm versions, with a one-click "install globally" option.
- **Configurable Copilot CLI location** — point the app at a `copilot` you installed yourself (e.g.
  via `npm install -g @github/copilot`) instead of the bundled one. Besides preference, this also
  sidesteps macOS Gatekeeper's quarantine flag on the app bundle, since npm-installed binaries are
  never quarantined the way a downloaded, unsigned app is.
- **Agent instructions editor** — a Settings panel section that reads/writes
  `.github/copilot-instructions.md` in the current session's directory, the same repo-level rules
  file the CLI's own `/init` command and instruction loading use.
- **Configurable external editor** — VS Code, Cursor, Zed, Sublime, WebStorm, vim, a custom binary, or
  the OS default, for jumping from a tool call straight into your own tools.
- **Five themes, one token set** — Graphite, Paper, and three real GitHub/Primer palettes (GitHub
  Dark, GitHub Dark Dimmed, GitHub Light) — all driven by the same CSS custom properties, shared
  between the app and the marketing site, so there's exactly one place each theme's colors live.

## Repository layout

```
src/main/       Electron main process: ACP client, agent/queue manager, db, auth, cli-locator,
                editor launcher, environment detection, terminal manager, IPC wiring
src/preload/    contextBridge API — the only surface the renderer can call into Node/Electron through
src/renderer/   React UI (Vite-built)
src/shared/     IPC channel names + payload types shared by main/preload/renderer
scripts/        fetch-cli.mjs — (re-)downloads/updates the vendored CLI binaries
resources/      Vendored copilot CLI binaries for all 4 platforms (Git LFS, see below)
site/           Static multi-page marketing site
test/           Vitest suites (SQLite queue behavior + integration tests against the real CLI)
.github/        CI (lint/typecheck/test/build) and gated multi-platform release workflows
```

## Development

```sh
npm install
npm run typecheck
npm test
npm run dev
```

Nothing else is required for a fresh clone — the CLI binaries for all 4 platforms
(`darwin-arm64`/`darwin-x64`/`win32-x64`/`linux-x64`) are vendored directly in this repo under
`resources/copilot-cli/` via **Git LFS**, so `git clone` (with LFS support) gets you a fully working
dev environment with no separate download step. If you don't already have Git LFS, install it once
(`git lfs install`) before cloning, or run `git lfs pull` after a plain clone.

To update the vendored binaries to a newer published CLI version:

```sh
npm run fetch-cli darwin-arm64
npm run fetch-cli darwin-x64
npm run fetch-cli win32-x64
npm run fetch-cli linux-x64
git add resources/copilot-cli && git commit -m "chore: update vendored copilot CLI"
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
packed inside `app.asar`, which Electron cannot `dlopen` (a real bug this project hit and fixed; see
git history). Each platform's installer bundles only its own vendored CLI binary via `extraResources`.

See [`.github/workflows/release.yml`](.github/workflows/release.yml) for the automated multi-platform
release pipeline (tag-push or manual-dispatch only — never on a plain push to `main`, so the scarce
macOS runners aren't queued for every commit). All three platform jobs upload build artifacts, and a
single final job creates the GitHub Release with everything attached — building and publishing
per-platform independently is a real race condition (multiple parallel `--publish always` calls can
create separate fragmented draft releases for the same tag), which this pipeline avoids by publishing
exactly once after all builds finish.

## Troubleshooting

- **macOS says the app "contains malware" / won't open** — the build isn't code-signed or notarized
  (that requires a paid Apple Developer Program membership this project doesn't have), so Gatekeeper
  blocks it the same way it would any unsigned download. Open **System Settings → Privacy & Security**
  → scroll down → **"Open Anyway"**, or run `xattr -cr /path/to/Copilot Desktop.app` in Terminal. This
  is expected for unsigned open-source Mac apps generally, not specific to this one. Pointing the app
  at a `copilot` you installed yourself (Settings → Copilot CLI location) sidesteps this for the CLI
  binary specifically, since npm-installed binaries are never quarantined.
- **A packaged Linux build renders a blank window** — this project hit exactly this bug: Vite marks
  the built entry `<script>`/`<link>` tags `crossorigin`, which makes Chromium fetch them in CORS mode;
  that fails silently under the `file://` protocol used to load the packaged renderer (no dev server,
  no CORS headers). `electron.vite.config.ts` strips the attribute via a small
  `transformIndexHtml` plugin.

## Site

`site/` is a static multi-page marketing site (`index.html`, `features.html`, `preview.html`,
`faq.html`, `download.html`, `docs.html`), sharing the app's design tokens (`styles.css`) and theme
toggle (`theme.js`).

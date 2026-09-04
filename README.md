# Copilot Desktop

An Electron shell around the official [GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot). The main
process spawns `copilot --acp` (the CLI's Agent Client Protocol server) and speaks newline-delimited
JSON-RPC over its stdio — no scraped terminal output, no reimplemented chat engine.

This is an independent, unaffiliated client.

## Features

- Real ACP client: `initialize`, `session/new`, `session/prompt`, `session/cancel`, `session/set_mode`,
  live `session/update` streaming (message/thought chunks, plans, tool calls), and inbound
  `session/request_permission`.
- Per-session send queue backed by SQLite: messages sent mid-turn are queued and dispatched in order
  once the current turn finishes, and survive a crash mid-send.
- `copilot login` device-code sign-in — the token exchange never leaves the CLI process.
- Configurable external editor (VS Code, Cursor, Zed, Sublime, WebStorm, vim, or a custom binary).
- React UI: session rail, message log, live status rail, permission dialog, auth panel, settings.

## Development

```sh
npm install
npm run fetch-cli   # downloads the copilot CLI binary for your platform
npm run typecheck
npm test
npm run dev
```

## Packaging

```sh
npm run fetch-cli <platform>   # darwin-arm64 | darwin-x64 | win32-x64 | linux-x64
npm run build
npx electron-builder --mac|--win|--linux
```

See [`.github/workflows/release.yml`](.github/workflows/release.yml) for the automated multi-platform
release pipeline.

## Site

`site/` is a static multi-page marketing site (`index.html`, `features.html`, `preview.html`,
`faq.html`, `download.html`), sharing the app's design tokens (`styles.css`) and theme toggle
(`theme.js`).
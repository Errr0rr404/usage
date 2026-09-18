# Usage

A small floating desktop meter for Grok, MiniMax, Codex, and Claude. Sign in with your usual browser. Usage reads what is left on each account and keeps the session on this computer.

It runs on macOS and Windows.

## Run it

You need Node.js 22 or newer.

```bash
npm install
npm start
```

Hide sends the window to the menu bar on macOS, or the notification area on Windows. Quit from that icon. Keep on top, in the settings menu, holds the window above other apps. On macOS it also stays visible on every desktop.

## Sign in

Each service opens the public login that can hand a session back to an app on this computer. The approval page may say Grok CLI, MiniMax CLI, Codex, or Claude Code. That is expected. Usage does not have its own account, and it does not send your login anywhere except the service you picked.

Sessions are locked with the operating system: the macOS keychain, or Windows DPAPI.

## Build

```bash
npm run dist:mac
npm run dist:win
```

A macOS machine builds the Mac app. A Windows machine, or the GitHub Actions workflow, builds the Windows installer. Tagged releases upload both. The Mac build is unsigned, so the first open is Control-click, then Open.

## License

[MIT](LICENSE)

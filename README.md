# Usage Monitor

A small floating desktop meter for Grok, MiniMax, Codex, Claude, Cursor, Copilot, and Gemini. Sign in with your usual browser. Usage Monitor reads what is left on each account and keeps the session on this computer.

![Usage Monitor, with Grok, MiniMax, Codex, and Cursor on one board](docs/screenshot.jpg)

It runs on macOS and Windows.

## Run it

You need Node.js 22 or newer.

```bash
npm install
npm start
```

Hide sends the window to the menu bar on macOS, or the notification area on Windows. Quit from that icon. Keep on top, in the settings menu, holds the window above other apps. On macOS it also stays visible on every desktop.

Usage Monitor refreshes every 5 minutes. Change that, or turn it off, from the settings menu.

## Sign in

Each service opens the public login that can hand a session back to an app on this computer. The approval page may say Grok CLI, MiniMax CLI, Codex, Claude Code, Cursor, Visual Studio Code, or Gemini CLI. That is expected. Usage Monitor does not have its own account, and it does not send your login anywhere except the service you picked.

The menu bar icon shows the lowest amount left. If a window drops under 15 percent, Usage Monitor sends one notification. It does not ping again until that window recovers and drops again.

Sessions are locked with the operating system: the macOS keychain, or Windows DPAPI.

## Download

Installers are on the [latest release](https://github.com/Errr0rr404/usage-monitor/releases/latest).

| Computer | File |
| --- | --- |
| Mac with Apple silicon | `Usage-Monitor-*-mac-arm64.dmg` |
| Mac with Intel | `Usage-Monitor-*-mac-x64.dmg` |
| Windows 64-bit | `Usage-Monitor-*-win-x64.exe` |
| Windows 32-bit | `Usage-Monitor-*-win-ia32.exe` |

The zip files are the same Mac apps without a disk image.

These builds are not signed. On a Mac, Control-click Usage Monitor the first time and choose Open. On Windows, if SmartScreen appears, choose More info, then Run anyway. Usage Monitor needs Windows 10 or newer, including 32-bit Windows.

## Build

```bash
npm run dist:mac
npm run dist:win
```

`dist:mac` builds Apple silicon and Intel. `dist:win` builds 64-bit and 32-bit installers. A tag named `v*` runs both on GitHub Actions and attaches the files to that release.

## License

[MIT](LICENSE)

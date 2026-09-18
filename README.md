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

Usage refreshes every 5 minutes. Change that, or turn it off, from the settings menu.

## Sign in

Each service opens the public login that can hand a session back to an app on this computer. The approval page may say Grok CLI, MiniMax CLI, Codex, or Claude Code. That is expected. Usage does not have its own account, and it does not send your login anywhere except the service you picked.

Sessions are locked with the operating system: the macOS keychain, or Windows DPAPI.

## Download

Installers are on the [latest release](https://github.com/Errr0rr404/usage/releases/latest).

| Computer | File |
| --- | --- |
| Mac with Apple silicon | `Usage-*-mac-arm64.dmg` |
| Mac with Intel | `Usage-*-mac-x64.dmg` |
| Windows 64-bit | `Usage-*-win-x64.exe` |
| Windows 32-bit | `Usage-*-win-ia32.exe` |

The zip files are the same Mac apps without a disk image.

These builds are not signed. On a Mac, Control-click Usage the first time and choose Open. On Windows, if SmartScreen appears, choose More info, then Run anyway. Usage needs Windows 10 or newer, including 32-bit Windows.

## Build

```bash
npm run dist:mac
npm run dist:win
```

`dist:mac` builds Apple silicon and Intel. `dist:win` builds 64-bit and 32-bit installers. A tag named `v*` runs both on GitHub Actions and attaches the files to that release.

## License

[MIT](LICENSE)

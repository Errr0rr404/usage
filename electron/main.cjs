const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./store.cjs');
const { fetchUsage } = require('../lib/fetch.cjs');
const { cleanSecret, extractCodexAuth, extractGrokAuth } = require('../lib/parse.cjs');
const { previewState } = require('../lib/preview.cjs');
const { trayPng } = require('../lib/tray-icon.cjs');
const { signIn, cancelSignIn } = require('./browser-login.cjs');

const darwin = process.platform === 'darwin';
const windows = process.platform === 'win32';

const preview = process.argv.includes('--preview') || process.argv.includes('--shot');
const emptyPreview = process.argv.includes('--empty');
const formPreview = process.argv.includes('--form');
const PROVIDERS = new Set(['grok', 'minimax', 'codex', 'claude']);

app.setName('Usage');
if (windows) app.setAppUserModelId('app.usage.desktop');

let win = null;
let tray = null;
let normalBounds = null;
let compact = false;
let refreshing = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

function persistBounds() {
  if (!win || preview) return;
  const bounds = normalBounds || win.getBounds();
  store.updateSettings({ bounds, pinned: win.isAlwaysOnTop() });
}

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function hideWindow() {
  if (win) win.hide();
}

function pinWindow(target, pinned) {
  if (!target) return;
  if (darwin) {
    target.setAlwaysOnTop(pinned, 'floating');
    target.setVisibleOnAllWorkspaces(pinned, { visibleOnFullScreen: true });
    return;
  }
  target.setAlwaysOnTop(pinned);
}

function createTray() {
  const icon = nativeImage.createEmpty();
  if (darwin) {
    icon.addRepresentation({ scaleFactor: 1, width: 22, height: 22, buffer: trayPng(22) });
    icon.addRepresentation({ scaleFactor: 2, width: 44, height: 44, buffer: trayPng(44) });
    icon.setTemplateImage(true);
  } else {
    icon.addRepresentation({ scaleFactor: 1, width: 16, height: 16, buffer: trayPng(16, [255, 255, 255]) });
    icon.addRepresentation({ scaleFactor: 2, width: 32, height: 32, buffer: trayPng(32, [255, 255, 255]) });
  }
  tray = new Tray(icon);
  tray.setToolTip('Usage');
  const menu = Menu.buildFromTemplate([
    { label: 'Show Usage', click: showWindow },
    { label: 'Refresh', click: () => { showWindow(); if (win) win.webContents.send('usage:refresh-request'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  const toggle = () => {
    if (!win) return;
    if (win.isVisible()) hideWindow();
    else showWindow();
  };
  tray.on('click', toggle);
  tray.on('double-click', showWindow);
}

function createWindow() {
  const settings = preview ? { pinned: true, bounds: null } : store.getSettings();
  const shot = process.argv.includes('--shot');
  const saved = settings.bounds || {};
  let width = saved.width || 304;
  let height = saved.height || 500;
  if (!shot && width >= 360 && height >= 600) {
    width = 304;
    height = 500;
  }
  const bounds = { ...saved, width: shot ? 320 : width, height: shot ? 640 : height };
  win = new BrowserWindow({
    width: Math.max(280, bounds.width || 304),
    height: Math.max(360, bounds.height || 500),
    x: Number.isFinite(bounds.x) ? bounds.x : undefined,
    y: Number.isFinite(bounds.y) ? bounds.y : undefined,
    minWidth: 280,
    minHeight: 240,
    show: false,
    frame: false,
    transparent: !windows,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: settings.pinned !== false,
    hasShadow: true,
    roundedCorners: true,
    title: 'Usage',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: windows ? '#070b10' : '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (settings.pinned !== false) pinWindow(win, true);

  win.loadFile(path.join(__dirname, '../renderer/index.html'), {
    query: process.argv.includes('--menu') ? { menu: '1' } : {},
  });
  win.once('ready-to-show', () => win.show());
  win.on('close', (event) => {
    if (preview) return;
    event.preventDefault();
    hideWindow();
  });
  win.on('move', persistBounds);
  win.on('resize', () => {
    if (!compact) persistBounds();
  });

  if (process.argv.includes('--shot')) {
    win.webContents.once('did-finish-load', async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(os.tmpdir(), 'usage-preview.png'), image.toPNG());
      app.exit(0);
    });
  }
}

function accountsForRefresh() {
  if (!preview) return null;
  if (emptyPreview) return { accounts: [], snapshots: {} };
  return previewState();
}

async function refreshAll() {
  const canned = accountsForRefresh();
  if (canned) return canned;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rows = store.eachSecret();
    const snapshots = {};
    await Promise.all(rows.map(async ({ account, secret }) => {
      if (!secret) {
        snapshots[account.id] = {
          ok: false,
          error: 'The saved login could not be unlocked. Remove it and add it again.',
          windows: [],
          plan: null,
          identity: null,
          fetchedAt: new Date().toISOString(),
        };
        return;
      }
      snapshots[account.id] = await fetchUsage(account, secret);
    }));
    return { accounts: store.listPublic(), snapshots };
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function importPayload(provider, file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { ok: false, error: 'That file could not be read as login data.' };
  }
  if (provider === 'codex') {
    const auth = extractCodexAuth(data);
    if (!auth) return { ok: false, error: 'That file has no Codex access token.' };
    const saved = store.addAccount({
      provider: 'codex',
      label: auth.email || 'Codex',
      secret: auth.accessToken,
      meta: auth.accountId ? { accountId: auth.accountId } : {},
    });
    return { ok: true, created: saved.created ? 1 : 0, skipped: saved.created ? 0 : 1 };
  }
  const entries = extractGrokAuth(data).filter((entry) => {
    if (!entry.expiresAt) return true;
    const time = new Date(entry.expiresAt).getTime();
    return Number.isNaN(time) || time > Date.now();
  });
  if (!entries.length) {
    return { ok: false, error: 'No current Grok login was in that file. Run grok login, then import again.' };
  }
  let created = 0;
  let skipped = 0;
  entries.forEach((entry, index) => {
    const saved = store.addAccount({
      provider: 'grok',
      label: entry.email || (entries.length > 1 ? `Grok ${index + 1}` : 'Grok'),
      secret: entry.token,
      meta: {},
    });
    if (saved.created) created += 1;
    else skipped += 1;
  });
  return { ok: true, created, skipped };
}

function defaultAuthFile(provider) {
  const home = app.getPath('home');
  if (provider === 'codex') return path.join(home, '.codex', 'auth.json');
  if (provider === 'grok') return path.join(home, '.grok', 'auth.json');
  return null;
}

ipcMain.handle('window:state', () => ({
  pinned: win ? win.isAlwaysOnTop() : true,
  preview,
  form: formPreview ? 'claude' : '',
  theme: store.getSettings().theme || 'ion',
  platform: process.platform,
}));

ipcMain.handle('window:theme', (_event, theme) => {
  const next = ['ion', 'ember', 'void'].includes(theme) ? theme : 'ion';
  if (!preview) store.updateSettings({ theme: next });
  return next;
});

ipcMain.handle('window:pin', (_event, pinned) => {
  if (!win) return false;
  const next = Boolean(pinned);
  pinWindow(win, next);
  if (!preview) store.updateSettings({ pinned: next });
  return next;
});

ipcMain.handle('window:compact', (_event, payload) => {
  if (!win) return false;
  const next = Boolean(payload?.compact);
  const height = Math.max(220, Math.min(520, Number(payload?.height) || 320));
  if (next && !compact) {
    normalBounds = win.getBounds();
    compact = true;
    win.setSize(normalBounds.width, height, false);
  } else if (!next && compact) {
    compact = false;
    if (normalBounds) win.setBounds(normalBounds);
    normalBounds = null;
  }
  return compact;
});

ipcMain.handle('window:hide', () => {
  hideWindow();
  return true;
});

ipcMain.handle('usage:refresh', () => refreshAll());

ipcMain.handle('auth:signin', async (_event, payload) => {
  if (preview) return { ok: false, error: 'Preview mode does not sign in.' };
  const provider = payload?.provider;
  if (!PROVIDERS.has(provider)) return { ok: false, error: 'Choose Grok, MiniMax, Codex, or Claude.' };
  const wasOnTop = win ? win.isAlwaysOnTop() : false;
  if (win) win.setAlwaysOnTop(false);
  try {
    const result = await signIn(provider, {
      region: payload?.region,
      onProgress: (hint) => {
        if (win && !win.isDestroyed()) win.webContents.send('auth:hint', hint);
      },
    });
    if (result.canceled) return { ok: false, canceled: true };
    if (!result.ok || !result.secret) {
      return { ok: false, error: result.error || 'Sign-in did not finish.' };
    }
    const meta = {};
    if (provider === 'minimax') {
      meta.region = payload?.region === 'cn' ? 'cn' : 'global';
      meta.countsAre = 'remaining';
    }
    if (provider === 'codex' && result.accountId) meta.accountId = result.accountId;
    const saved = store.addAccount({
      provider,
      label: String(payload?.label || '').trim() || result.email || providerName(provider),
      secret: result.secret,
      meta,
    });
    return { ok: true, account: saved.account, created: saved.created };
  } catch (error) {
    return { ok: false, error: error.message || 'Sign-in could not finish.' };
  } finally {
    if (win && wasOnTop) pinWindow(win, true);
    showWindow();
  }
});

ipcMain.handle('auth:cancel', () => {
  cancelSignIn();
  return true;
});

ipcMain.handle('accounts:add', (_event, payload) => {
  if (preview) return { ok: false, error: 'Preview mode does not save accounts.' };
  const provider = payload?.provider;
  const secret = cleanSecret(payload?.secret);
  const label = String(payload?.label || '').trim();
  if (!PROVIDERS.has(provider)) return { ok: false, error: 'Choose Grok, MiniMax, Codex, or Claude.' };
  if (!secret) return { ok: false, error: 'Paste a login first.' };
  try {
    const meta = {};
    if (provider === 'minimax') meta.region = payload?.region === 'cn' ? 'cn' : 'global';
    if (provider === 'minimax') meta.countsAre = 'remaining';
    const saved = store.addAccount({
      provider,
      label: label || providerName(provider),
      secret,
      meta,
    });
    return { ok: true, account: saved.account, created: saved.created };
  } catch (error) {
    return { ok: false, error: error.message || 'The login could not be saved.' };
  }
});

ipcMain.handle('accounts:update', (_event, id, patch) => {
  if (preview) return null;
  return store.updateAccount(id, patch || {});
});

ipcMain.handle('accounts:remove', (_event, id) => {
  if (preview) return previewState().accounts;
  return store.removeAccount(id);
});

async function chooseFile() {
  const picked = await dialog.showOpenDialog(win, {
    title: 'Choose a login file',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (picked.canceled || !picked.filePaths[0]) return null;
  return picked.filePaths[0];
}

ipcMain.handle('auth:import', async (_event, provider) => {
  if (preview) return { ok: false, error: 'Preview mode does not import logins.' };
  if (provider !== 'codex' && provider !== 'grok') {
    return { ok: false, error: 'Only Codex and Grok can import a login file.' };
  }
  const file = defaultAuthFile(provider);
  if (!file || !fs.existsSync(file)) {
    return { ok: false, missing: true, error: provider === 'codex'
      ? 'No Codex login was found on this computer.'
      : 'No Grok login was found on this computer.' };
  }
  return importPayload(provider, file);
});

ipcMain.handle('auth:choose', async (_event, provider) => {
  if (preview) return { ok: false, error: 'Preview mode does not import logins.' };
  if (provider !== 'codex' && provider !== 'grok') {
    return { ok: false, error: 'Only Codex and Grok can import a login file.' };
  }
  const file = await chooseFile();
  if (!file) return { ok: false, canceled: true };
  return importPayload(provider, file);
});

function providerName(id) {
  return { grok: 'Grok', minimax: 'MiniMax', codex: 'Codex', claude: 'Claude' }[id] || 'Account';
}

app.whenReady().then(() => {
  createTray();
  createWindow();
  app.on('activate', () => {
    if (!win) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', () => {
  if (preview) app.quit();
});

app.on('before-quit', () => {
  if (win) win.removeAllListeners('close');
});

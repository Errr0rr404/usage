const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');
const { sessionFromSecret } = require('../lib/oauth.cjs');

function dataFile() {
  return path.join(app.getPath('userData'), 'accounts.json');
}

function emptyState() {
  return {
    settings: { pinned: true, bounds: null },
    accounts: [],
  };
}

function readState() {
  try {
    const raw = fs.readFileSync(dataFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      settings: { pinned: true, bounds: null, ...(parsed.settings || {}) },
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = `${JSON.stringify(state, null, 2)}\n`;
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, file);
}

function seal(text) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('This computer cannot lock logins in its secure store.');
  }
  return safeStorage.encryptString(text).toString('base64');
}

function openSecret(sealed) {
  return safeStorage.decryptString(Buffer.from(sealed, 'base64'));
}

function publicAccount(account) {
  return {
    id: account.id,
    provider: account.provider,
    label: account.label,
    meta: account.meta || {},
  };
}

function listPublic() {
  return readState().accounts.map(publicAccount);
}

function getSettings() {
  return readState().settings;
}

function updateSettings(patch) {
  const state = readState();
  state.settings = { ...state.settings, ...patch };
  writeState(state);
  return state.settings;
}

function fingerprint(secret) {
  return crypto.createHash('sha256').update(sessionFromSecret(secret).token).digest('hex');
}

function addAccount({ provider, label, secret, meta }) {
  const state = readState();
  const hash = fingerprint(secret);
  const duplicate = state.accounts.find((account) => account.provider === provider && account.hash === hash);
  if (duplicate) return { account: publicAccount(duplicate), created: false };
  const account = {
    id: crypto.randomUUID(),
    provider,
    label: label || provider,
    meta: meta || {},
    hash,
    secret: seal(secret),
  };
  state.accounts.push(account);
  writeState(state);
  return { account: publicAccount(account), created: true };
}

function updateAccount(id, patch) {
  const state = readState();
  const account = state.accounts.find((item) => item.id === id);
  if (!account) return null;
  if (typeof patch.label === 'string' && patch.label.trim()) account.label = patch.label.trim();
  if (patch.meta && typeof patch.meta === 'object') account.meta = { ...account.meta, ...patch.meta };
  writeState(state);
  return publicAccount(account);
}

function removeAccount(id) {
  const state = readState();
  state.accounts = state.accounts.filter((account) => account.id !== id);
  writeState(state);
  return listPublic();
}

function eachSecret() {
  return readState().accounts.map((account) => {
    let secret = '';
    try {
      secret = openSecret(account.secret);
    } catch {
      secret = '';
    }
    return {
      account: publicAccount(account),
      secret,
    };
  });
}

module.exports = {
  listPublic,
  getSettings,
  updateSettings,
  addAccount,
  updateAccount,
  removeAccount,
  eachSecret,
};

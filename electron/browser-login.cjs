const http = require('http');
const { shell } = require('electron');
const { decodeJwt } = require('../lib/parse.cjs');
const {
  PROVIDERS,
  pkce,
  authorizeUrl,
  normalizeMinimaxUri,
  deadlineFrom,
  bundleSecret,
} = require('../lib/oauth.cjs');

let current = null;

function htmlPage(title, message) {
  const safe = String(message || '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  return `<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>${safe}</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#23272c;color:#f3f0e8;font-family:Avenir Next,Segoe UI,sans-serif"><p style="font-size:18px">${safe}</p></body></html>`;
}

function listen(port, host, handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeAllListeners('error');
      resolve(server);
    });
  });
}

async function openLoopback(spec, handler) {
  const servers = [];
  const hosts = spec.bind ? [spec.bind] : ['127.0.0.1', '::1'];
  let firstError = null;
  for (const host of hosts) {
    try {
      servers.push(await listen(spec.port, host, handler));
    } catch (error) {
      if (!firstError) firstError = error;
    }
  }
  if (!servers.length) {
    const busy = firstError && firstError.code === 'EADDRINUSE';
    throw new Error(busy
      ? 'The login port is already in use. Quit any other sign-in, then try again.'
      : 'The login handshake could not start.');
  }
  return {
    close() {
      servers.forEach((server) => server.close());
    },
  };
}

function emailFromToken(token) {
  const payload = decodeJwt(token) || {};
  const profile = payload['https://api.openai.com/profile'] || {};
  const auth = payload['https://api.openai.com/auth'] || {};
  return {
    email: profile.email || payload.email || null,
    accountId: auth.chatgpt_account_id || null,
  };
}

async function exchange(spec, { code, verifier, state }) {
  const headers = { Accept: 'application/json' };
  let body;
  if (spec.tokenStyle === 'json') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: spec.redirect,
      client_id: spec.clientId,
      code_verifier: verifier,
      state,
    });
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: spec.redirect,
      client_id: spec.clientId,
      code_verifier: verifier,
    }).toString();
  }
  const response = await fetch(spec.token, { method: 'POST', headers, body, signal: AbortSignal.timeout(20000) });
  const text = await response.text();
  if (!response.ok) {
    throw new Error('The sign-in handshake was rejected. Try again.');
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('The sign-in handshake returned something unexpected.');
  }
  if (!json.access_token) throw new Error('The sign-in handshake did not return a session.');
  return json;
}

function signInLoopback(provider, onProgress) {
  const spec = PROVIDERS[provider];
  const flow = pkce();
  const url = authorizeUrl(provider, flow);

  return new Promise((resolve) => {
    let settled = false;
    let gateway = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      current = null;
      if (gateway) gateway.close();
      resolve(result);
    };
    const timeout = setTimeout(() => {
      finish({ ok: false, error: 'Sign-in took too long. Try again.' });
    }, 6 * 60 * 1000);

    let received = false;
    const handler = (request, response) => {
      const requestUrl = new URL(request.url || '/', spec.redirect);
      if (requestUrl.pathname !== spec.path) {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Not found');
        return;
      }
      const error = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
      if (error) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(htmlPage('Sign-in stopped', 'Sign-in was not approved. You can close this tab.'));
        finish({ ok: false, error: 'Sign-in was not approved.' });
        return;
      }
      if (requestUrl.searchParams.get('state') !== flow.state) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(htmlPage('Sign-in stopped', 'This sign-in did not match the one Usage started.'));
        finish({ ok: false, error: 'The sign-in handshake did not match. Try again.' });
        return;
      }
      if (received) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(htmlPage('Signed in', 'Signed in. You can close this tab and return to Usage.'));
        return;
      }
      received = true;
      const code = requestUrl.searchParams.get('code');
      if (!code) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(htmlPage('Sign-in stopped', 'The browser did not return a login code.'));
        finish({ ok: false, error: 'The browser did not return a login code.' });
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(htmlPage('Signed in', 'Signed in. You can close this tab and return to Usage.'));
      exchange(spec, { code, verifier: flow.verifier, state: flow.state })
        .then((tokens) => {
          const identity = emailFromToken(tokens.access_token);
          finish({
            ok: true,
            secret: bundleSecret(tokens),
            email: identity.email,
            accountId: identity.accountId,
          });
        })
        .catch((exchangeError) => {
          finish({ ok: false, error: exchangeError.message || 'The sign-in handshake was rejected. Try again.' });
        });
    };

    current = { finish };
    openLoopback(spec, handler)
      .then((opened) => {
        if (settled) {
          opened.close();
          return;
        }
        gateway = opened;
        if (onProgress) onProgress({ message: 'Your browser is open. Sign in, then it hands the session back here.' });
        return shell.openExternal(url);
      })
      .catch((error) => {
        finish({ ok: false, error: error.message || 'The browser could not be opened.' });
      });
  });
}

async function signInDevice(region, onProgress, session) {
  const spec = PROVIDERS.minimax;
  const host = spec.hosts[region === 'cn' ? 'cn' : 'global'];
  const flow = pkce();
  const codeResponse = await fetch(`${host}/oauth2/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: spec.clientId,
      scope: spec.scope,
      code_challenge: flow.challenge,
      code_challenge_method: 'S256',
      state: flow.state,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!codeResponse.ok) throw new Error('MiniMax could not start sign-in. Try again.');
  const data = await codeResponse.json();
  if (!data.verification_uri || !data.user_code) throw new Error('MiniMax did not return a sign-in page.');
  if (data.state && data.state !== flow.state) throw new Error('The sign-in handshake did not match. Try again.');
  if (session.canceled) return { ok: false, canceled: true };
  const page = normalizeMinimaxUri(data.verification_uri);
  await shell.openExternal(page);
  if (onProgress) {
    onProgress({ message: `Your browser is open. Approve the login there. If it asks for a code, enter ${data.user_code}.` });
  }
  const deadline = deadlineFrom(data.expired_in);
  let wait = Number(data.interval) || 3000;
  if (wait < 200) wait *= 1000;
  while (Date.now() < deadline) {
    if (session.canceled) return { ok: false, canceled: true };
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, wait);
      session.finish = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    if (session.canceled) return { ok: false, canceled: true };
    const tokenResponse = await fetch(`${host}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: spec.clientId,
        user_code: data.user_code,
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const token = await tokenResponse.json().catch(() => ({}));
    if (token.status === 'pending' || token.error === 'authorization_pending') continue;
    if (token.error === 'slow_down') {
      wait = Math.min(wait + 2000, 15000);
      continue;
    }
    if (!tokenResponse.ok) throw new Error('MiniMax rejected the sign-in handshake.');
    if (token.access_token) {
      return {
        ok: true,
        secret: bundleSecret(token),
        email: null,
        accountId: null,
      };
    }
    if (token.status && token.status !== 'pending') {
      throw new Error('MiniMax did not finish sign-in.');
    }
  }
  throw new Error('Sign-in took too long. Try again.');
}

function signIn(provider, options = {}) {
  const onProgress = options.onProgress;
  if (provider === 'minimax') {
    const session = { canceled: false, finish: null };
    current = session;
    return signInDevice(options.region, onProgress, session)
      .catch((error) => ({
        ok: false,
        error: error.message || 'Sign-in could not finish.',
      }))
      .finally(() => {
        if (current === session) current = null;
      });
  }
  if (!PROVIDERS[provider] || PROVIDERS[provider].mode !== 'loopback') {
    return Promise.resolve({ ok: false, error: 'Choose a service first.' });
  }
  return signInLoopback(provider, onProgress);
}

function cancelSignIn() {
  if (!current) return;
  current.canceled = true;
  if (current.finish) current.finish({ ok: false, canceled: true });
}

module.exports = { signIn, cancelSignIn };

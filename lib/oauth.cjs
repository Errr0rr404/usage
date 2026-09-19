const crypto = require('crypto');

const PROVIDERS = {
  claude: {
    mode: 'loopback',
    authorize: 'https://claude.com/cai/oauth/authorize',
    token: 'https://platform.claude.com/v1/oauth/token',
    clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    redirect: 'http://localhost:54545/callback',
    port: 54545,
    path: '/callback',
    scope: 'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload',
    tokenStyle: 'json',
  },
  codex: {
    mode: 'loopback',
    authorize: 'https://auth.openai.com/oauth/authorize',
    token: 'https://auth.openai.com/oauth/token',
    clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
    redirect: 'http://localhost:1455/auth/callback',
    port: 1455,
    path: '/auth/callback',
    scope: 'openid profile email offline_access',
    tokenStyle: 'form',
  },
  grok: {
    mode: 'loopback',
    authorize: 'https://auth.x.ai/oauth2/authorize',
    token: 'https://auth.x.ai/oauth2/token',
    clientId: 'b1a00492-073a-47ea-816f-4c329264a828',
    redirect: 'http://127.0.0.1:56121/callback',
    port: 56121,
    path: '/callback',
    bind: '127.0.0.1',
    scope: 'openid profile email offline_access grok-cli:access api:access',
    tokenStyle: 'form',
  },
  minimax: {
    mode: 'device',
    clientId: '659cf4c1-615c-45f6-a5f6-4bf15eb476e5',
    scope: 'openid profile coding_plan',
    hosts: {
      global: 'https://account.minimax.io',
      cn: 'https://account.minimaxi.com',
    },
  },
  cursor: {
    mode: 'poll',
    login: 'https://cursor.com/loginDeepControl',
    poll: 'https://api2.cursor.sh/auth/poll',
  },
  copilot: {
    mode: 'device',
    clientId: 'Iv1.b507a08c87ecfe98',
    scope: 'read:user',
    device: 'https://github.com/login/device/code',
    token: 'https://github.com/login/oauth/access_token',
  },
  gemini: {
    mode: 'loopback',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    redirect: 'http://localhost:51121/oauth-callback',
    port: 51121,
    path: '/oauth-callback',
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs',
    tokenStyle: 'form',
  },
};

function pkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  return { verifier, challenge, state, nonce };
}

function authorizeUrl(provider, flow) {
  const spec = PROVIDERS[provider];
  if (!spec || spec.mode !== 'loopback') return null;
  const params = new URLSearchParams();
  if (provider === 'claude') params.set('code', 'true');
  params.set('client_id', spec.clientId);
  params.set('response_type', 'code');
  params.set('redirect_uri', spec.redirect);
  params.set('scope', spec.scope);
  params.set('code_challenge', flow.challenge);
  params.set('code_challenge_method', 'S256');
  params.set('state', flow.state);
  if (provider === 'codex') {
    params.set('id_token_add_organizations', 'true');
    params.set('codex_cli_simplified_flow', 'true');
    params.set('originator', 'codex');
  }
  if (provider === 'grok') {
    params.set('nonce', flow.nonce);
    params.set('plan', 'generic');
    params.set('referrer', 'grok-cli');
  }
  if (provider === 'gemini') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }
  return `${spec.authorize}?${params.toString()}`;
}

function normalizeMinimaxUri(uri) {
  let url;
  try {
    url = new URL(uri);
  } catch {
    return uri;
  }
  if (url.pathname !== '/oauth-authorize') return uri;
  if (url.hostname === 'www.minimax.io') url.hostname = 'platform.minimax.io';
  if (url.hostname === 'www.minimaxi.com') url.hostname = 'platform.minimaxi.com';
  return url.toString();
}

function deadlineFrom(expiredIn) {
  const value = Number(expiredIn);
  if (!Number.isFinite(value) || value <= 0) return Date.now() + 5 * 60 * 1000;
  if (value > 1e12) return value;
  if (value > 1e9) return value * 1000;
  return Date.now() + value * 1000;
}

function bundleSecret(tokens, extra = {}) {
  return JSON.stringify({
    accessToken: tokens.access_token || tokens.accessToken,
    refreshToken: tokens.refresh_token || tokens.refreshToken || '',
    resourceUrl: extra.resourceUrl || tokens.resource_url || '',
  });
}

function sessionFromSecret(secret) {
  const text = String(secret || '').trim();
  if (text.startsWith('{')) {
    try {
      const json = JSON.parse(text);
      if (typeof json.accessToken === 'string' && json.accessToken) {
        return {
          token: json.accessToken,
          resourceUrl: json.resourceUrl || '',
        };
      }
    } catch {
      // Plain tokens are stored as text.
    }
  }
  return { token: text, resourceUrl: '' };
}

module.exports = {
  PROVIDERS,
  pkce,
  authorizeUrl,
  normalizeMinimaxUri,
  deadlineFrom,
  bundleSecret,
  sessionFromSecret,
};

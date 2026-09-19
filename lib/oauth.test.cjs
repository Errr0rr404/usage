const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizeUrl, pkce, normalizeMinimaxUri, deadlineFrom, sessionFromSecret, bundleSecret } = require('./oauth.cjs');

test('authorize urls point at the service and a localhost handshake', () => {
  const flow = pkce();
  const claude = new URL(authorizeUrl('claude', flow));
  assert.equal(claude.origin, 'https://claude.com');
  assert.equal(claude.searchParams.get('redirect_uri'), 'http://localhost:54545/callback');
  assert.equal(claude.searchParams.get('code_challenge_method'), 'S256');

  const codex = new URL(authorizeUrl('codex', flow));
  assert.equal(codex.origin, 'https://auth.openai.com');
  assert.equal(codex.searchParams.get('redirect_uri'), 'http://localhost:1455/auth/callback');

  const grok = new URL(authorizeUrl('grok', flow));
  assert.equal(grok.searchParams.get('redirect_uri'), 'http://127.0.0.1:56121/callback');
  assert.equal(grok.searchParams.get('plan'), 'generic');

  const gemini = new URL(authorizeUrl('gemini', flow));
  assert.equal(gemini.origin, 'https://accounts.google.com');
  assert.equal(gemini.searchParams.get('redirect_uri'), 'http://127.0.0.1:53821/oauth2callback');
  assert.equal(gemini.searchParams.get('code_challenge_method'), 'S256');
});

test('minimax verification links land on the live authorize page', () => {
  assert.equal(
    new URL(normalizeMinimaxUri('https://www.minimax.io/oauth-authorize?user_code=AB12')).hostname,
    'platform.minimax.io',
  );
  assert.equal(normalizeMinimaxUri('https://platform.minimax.io/login'), 'https://platform.minimax.io/login');
});

test('device deadlines accept seconds and absolute timestamps', () => {
  const soon = deadlineFrom(30);
  assert.ok(soon > Date.now());
  assert.ok(soon < Date.now() + 40 * 1000);
  assert.equal(deadlineFrom(1_779_000_000_000), 1_779_000_000_000);
});

test('saved sessions keep the access token without exposing it as plain meta', () => {
  const secret = bundleSecret({ access_token: 'token-value', refresh_token: 'refresh-value', resource_url: 'https://api.minimax.io' });
  assert.equal(sessionFromSecret(secret).token, 'token-value');
  assert.equal(sessionFromSecret(secret).resourceUrl, 'https://api.minimax.io');
  assert.equal(sessionFromSecret('plain-token').token, 'plain-token');
});

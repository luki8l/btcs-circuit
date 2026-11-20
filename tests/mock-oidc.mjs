// A stand-in for Microsoft's sign-in (OpenID Connect), for the postgres-mode tests only. Sign in with any e-mail;
// "other-org:x@y" comes back from another organisation (wrong tenant). Never used by the app itself.
import { createRequire } from 'node:module';
const Provider = (await import(createRequire(import.meta.url).resolve('oidc-provider'))).default;

export const TENANT = 'test-tenant-0000';
export async function startMockOidc({ port = 3201, appUrl = 'http://127.0.0.1:3300' } = {}) {
  const provider = new Provider(`http://127.0.0.1:${port}`, {
    clients: [{ client_id: 'circuit-test', client_secret: 'circuit-test-secret-0123456789', redirect_uris: [`${appUrl}/auth/callback`], response_types: ['code'], grant_types: ['authorization_code'] }],
    pkce: { required: () => true },
    claims: { openid: ['sub'], email: ['email'], profile: ['name', 'preferred_username', 'oid', 'tid'] },
    conformIdTokenClaims: false,
    features: { devInteractions: { enabled: true } },
    cookies: { keys: ['mock-oidc-test-key'] },
    async findAccount(_ctx, id) {
      const other = id.startsWith('other-org:'), email = id.replace(/^other-org:/, '').toLowerCase();
      return { accountId: id, async claims() { return { sub: 'sub-' + email, email, preferred_username: email, name: email.split('@')[0], oid: 'oid-' + email, tid: other ? 'another-tenant' : TENANT }; } };
    },
  });
  const server = provider.listen(port, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  return { issuer: `http://127.0.0.1:${port}`, close: () => new Promise(r => server.close(r)) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const m = await startMockOidc({ port: Number(process.env.MOCK_OIDC_PORT) || 3201, appUrl: process.env.APP_URL || 'http://127.0.0.1:3300' });
  console.log('mock OpenID provider at', m.issuer, '· client circuit-test · tenant', TENANT);
}

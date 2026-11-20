// Sign-in with Microsoft (Entra ID), postgres mode. Authorization code flow with PKCE, state and nonce;
// the ID token is checked by openid-client (signature, issuer, audience, expiry, nonce).
import * as oidc from 'openid-client';
import { siteUrl } from './backend';

export const entraTenant = () => process.env.ENTRA_TENANT_ID || '';
const issuer = () => process.env.ENTRA_ISSUER || `https://login.microsoftonline.com/${entraTenant()}/v2.0`;
export const redirectUri = () => `${siteUrl()}/auth/callback`;

let config: Promise<oidc.Configuration> | null = null;
export function entraConfig(): Promise<oidc.Configuration> {
  const id = process.env.ENTRA_CLIENT_ID, secret = process.env.ENTRA_CLIENT_SECRET;
  if (!id || !secret || (!process.env.ENTRA_ISSUER && !entraTenant()) || !siteUrl()) {
    return Promise.reject(new Error('Microsoft sign-in is not configured: ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET and SITE_URL are needed.'));
  }
  // plain http only for a test issuer on this machine (never for Microsoft)
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(issuer() + '/') && process.env.ENTRA_ALLOW_INSECURE_ISSUER === '1';
  config ??= oidc.discovery(new URL(issuer()), id, secret, undefined, local ? { execute: [oidc.allowInsecureRequests] } : undefined)
    .catch(e => { config = null; throw e; });
  return config;
}

/** where to send the browser, plus what to remember until it comes back */
export async function startSignIn() {
  const cfg = await entraConfig();
  const verifier = oidc.randomPKCECodeVerifier(), state = oidc.randomState(), nonce = oidc.randomNonce();
  const url = oidc.buildAuthorizationUrl(cfg, {
    redirect_uri: redirectUri(), scope: 'openid profile email', response_type: 'code',
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce,
  });
  return { url, verifier, state, nonce };
}

/** finish: exchange the code, check the token, return who signed in */
export async function finishSignIn(callbackUrl: URL, flow: { verifier: string; state: string; nonce: string }) {
  const cfg = await entraConfig();
  const tokens = await oidc.authorizationCodeGrant(cfg, callbackUrl, { pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true });
  const c = tokens.claims() as Record<string, unknown> | undefined;
  if (!c) throw new Error('no ID token');
  const tid = String(c.tid || ''), tenant = entraTenant();
  if (tenant && tid !== tenant) throw new Error('wrong organisation');
  const email = String(c.email || c.preferred_username || c.upn || '').toLowerCase();
  const oid = String(c.oid || c.sub || '');
  return { email, oid, name: String(c.name || '') };
}

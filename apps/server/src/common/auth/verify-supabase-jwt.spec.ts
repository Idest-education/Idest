import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import {
  verifySupabaseJwt,
  JwtVerificationError,
} from '@idest/shared';

const SECRET = 'test-hs256-secret-value-that-is-long-enough';
const ISSUER = 'https://ref.supabase.co/auth/v1';
const SUPABASE_URL = 'https://ref.supabase.co';

function hsKey() {
  return new TextEncoder().encode(SECRET);
}

async function signHs(claims: Record<string, unknown>, expiresIn = '1h') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(expiresIn)
    .sign(hsKey());
}

describe('verifySupabaseJwt', () => {
  afterEach(() => jest.restoreAllMocks());

  it('accepts a valid HS256 token and returns the payload', async () => {
    const token = await signHs({ sub: 'user-123', email: 'a@b.com' });
    const payload = await verifySupabaseJwt(token, {
      jwtSecret: SECRET,
      issuer: ISSUER,
      supabaseUrl: SUPABASE_URL,
    });
    expect(payload.sub).toBe('user-123');
    expect(payload.email).toBe('a@b.com');
  });

  it('rejects a token with a tampered signature', async () => {
    const token = (await signHs({ sub: 'user-123' })) + 'x';
    await expect(
      verifySupabaseJwt(token, { jwtSecret: SECRET, issuer: ISSUER }),
    ).rejects.toBeInstanceOf(JwtVerificationError);
  });

  it('rejects an expired token with reason "expired"', async () => {
    const token = await signHs({ sub: 'user-123' }, '-1h');
    await expect(
      verifySupabaseJwt(token, { jwtSecret: SECRET, issuer: ISSUER }),
    ).rejects.toMatchObject({ reason: 'expired' });
  });

  it('rejects a wrong issuer', async () => {
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('https://evil.example/auth/v1')
      .setExpirationTime('1h')
      .sign(hsKey());
    await expect(
      verifySupabaseJwt(token, { jwtSecret: SECRET, issuer: ISSUER }),
    ).rejects.toBeInstanceOf(JwtVerificationError);
  });

  it('throws "misconfigured" when neither secret nor url is provided', async () => {
    await expect(
      verifySupabaseJwt('whatever', {}),
    ).rejects.toMatchObject({ reason: 'misconfigured' });
  });

  it('falls back to JWKS (RS256) when HS256 is not configured', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    // jose's Node CJS build fetches the JWKS via node:https (not global.fetch),
    // so serve it from a real localhost endpoint instead of mocking fetch.
    const server = createServer((req, res) => {
      if (req.url === '/auth/v1/.well-known/jwks.json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ keys: [jwk] }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    );
    const supabaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      const token = await new SignJWT({ sub: 'user-999' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuedAt()
        .setIssuer(`${supabaseUrl}/auth/v1`)
        .setExpirationTime('1h')
        .sign(privateKey);

      const payload = await verifySupabaseJwt(token, { supabaseUrl });
      expect(payload.sub).toBe('user-999');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
